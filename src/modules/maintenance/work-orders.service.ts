import { ConflictError, NotFoundError, UnprocessableError } from '../../shared/errors.ts'
import { addDays, fleetInstant, fleetToday, type IsoDate } from '../../shared/time/fleet-time.ts'
import { planServices, type ServicedVehicle } from './domain/routine-services.ts'
import { workOrderProblem } from './domain/work-order-rules.ts'
import { workOrderStatus, type WorkOrderStatus } from './domain/work-order-status.ts'
import type {
  WorkOrderRow,
  WorkOrdersRepository,
  WorkOrderValues,
} from './work-orders.repository.ts'
import type {
  WorkOrder,
  WorkOrderCreate,
  WorkOrderList,
  WorkOrderListQuery,
  WorkOrderUpdate,
} from './work-orders.schemas.ts'

/** A trip as the workshop sees it: which vehicle it holds, and for how long */
export type VehicleTrip = { vehicleId: string; number: number; departsAt: Date; returnsAt: Date }

type Dependencies = {
  repository: WorkOrdersRepository
  /** The vehicles module supplies the fleet */
  listVehicles: () => Promise<ServicedVehicle[]>
  /** The trips module: trips still on that share time with the span, its days planned first */
  listTrips: (from: Date, to: Date) => Promise<VehicleTrip[]>
  /** The current time; tests pass a fixed one */
  now?: () => Date
}

/** A list covers this many days at most, so one request can't ask for years */
const LONGEST_LIST_DAYS = 62
/** Days get their routine services on demand only this close to today, like trips get their timetable */
const PLANNING_WINDOW = { pastDays: 31, futureDays: 14 }

const NOT_EDITABLE: Record<Exclude<WorkOrderStatus, 'scheduled'>, string> = {
  in_progress: 'under way',
  done: 'done',
  cancelled: 'cancelled',
}

/** Every day from `first` to `last`, both included */
function daysFrom(first: IsoDate, last: IsoDate): IsoDate[] {
  const days: IsoDate[] = []
  for (let day = first; day <= last; day = addDays(day, 1)) days.push(day)
  return days
}

/** The fleet's days a span of time touches, Kyiv time */
const daysOf = (from: Date, to: Date) =>
  daysFrom(fleetToday(from), fleetToday(new Date(to.getTime() - 1)))

export function createWorkOrdersService({
  repository,
  listVehicles,
  listTrips,
  now = () => new Date(),
}: Dependencies) {
  const toWorkOrder =
    (at: Date) =>
    (row: WorkOrderRow): WorkOrder => ({
      id: row.id,
      number: row.number,
      kind: row.kind,
      status: workOrderStatus(row, at),
      vehicle: row.vehicle,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      costUah: row.costUah,
      note: row.note,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
    })

  /** Makes sure the routine services of those days are booked before anyone looks at them. */
  async function ensurePlanned(days: IsoDate[]) {
    const today = fleetToday(now())
    const inWindow = days.filter(
      (day) =>
        day >= addDays(today, -PLANNING_WINDOW.pastDays) &&
        day <= addDays(today, PLANNING_WINDOW.futureDays),
    )
    const [first] = inWindow
    const last = inWindow.at(-1)
    if (!first || !last) return

    const planned = await repository.plannedDays(first, last)
    const missing = inWindow.filter((day) => !planned.has(day))
    if (missing.length === 0) return

    const vehicles = await listVehicles()
    await Promise.all(
      missing.map((day) => repository.addPlannedDay(day, planServices(day, vehicles))),
    )
  }

  async function getWorkOrder(id: string): Promise<WorkOrder> {
    const order = await repository.findById(id)
    if (!order) throw new NotFoundError('Work order', id)
    return toWorkOrder(now())(order)
  }

  /** The work order, if it can still be changed: once the vehicle is in the workshop, it's history. */
  async function editableWorkOrder(id: string) {
    const order = await repository.findById(id)
    if (!order) throw new NotFoundError('Work order', id)
    const status = workOrderStatus(order, now())
    if (status !== 'scheduled') {
      throw new ConflictError(
        'WORK_ORDER_NOT_EDITABLE',
        `Work order ${order.number} is ${NOT_EDITABLE[status]} and can no longer be changed`,
      )
    }
    return order
  }

  /** Checks a booking against the rules, the vehicle's trips and its other work orders; `exceptId` is the one being changed. */
  async function checkBooking(booking: WorkOrderValues, exceptId?: string) {
    // A fleet of a few dozen vehicles: looking one up in the full list is cheap
    const vehicle = (await listVehicles()).find((candidate) => candidate.id === booking.vehicleId)
    if (!vehicle) {
      throw new UnprocessableError('UNKNOWN_VEHICLE', `There is no vehicle ${booking.vehicleId}`)
    }
    const problem = workOrderProblem({ vehicle, ...booking }, now())
    if (problem) throw new UnprocessableError(problem.code, problem.message)

    // The routine services of those days go in first, so the booking is checked against them too
    await ensurePlanned(daysOf(booking.startsAt, booking.endsAt))

    const trips = (await listTrips(booking.startsAt, booking.endsAt)).filter(
      (trip) => trip.vehicleId === booking.vehicleId,
    )
    const [trip] = trips
    if (trip) {
      throw new ConflictError(
        'TRIP_OVERLAP',
        `The vehicle is on trip ${trip.number} at that time; move or cancel the trip first`,
        { trips: trips.map(({ number }) => number) },
      )
    }

    const orders = await repository.listOverlapping(
      booking.vehicleId,
      booking.startsAt,
      booking.endsAt,
      exceptId,
    )
    const [order] = orders
    if (order) {
      throw new ConflictError(
        'WORKSHOP_OVERLAP',
        `The vehicle is already booked into the workshop then (work order ${order.number})`,
        { workOrders: orders.map(({ number }) => number) },
      )
    }
  }

  return {
    async list(query: WorkOrderListQuery): Promise<WorkOrderList> {
      if (query.to < query.from || query.to > addDays(query.from, LONGEST_LIST_DAYS - 1)) {
        throw new UnprocessableError(
          'RANGE_TOO_LONG',
          `A list covers 1 to ${LONGEST_LIST_DAYS} days, with "to" on or after "from"`,
        )
      }
      await ensurePlanned(daysFrom(query.from, query.to))

      const at = now()
      const rows = await repository.list(
        {
          from: fleetInstant(query.from, 0),
          to: fleetInstant(addDays(query.to, 1), 0),
          vehicleId: query.vehicleId,
          status: query.status,
        },
        at,
      )
      return { items: rows.map(toWorkOrder(at)) }
    },

    get: getWorkOrder,

    async create(input: WorkOrderCreate): Promise<WorkOrder> {
      const values: WorkOrderValues = {
        vehicleId: input.vehicleId,
        kind: input.kind,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        costUah: input.costUah,
        note: input.note ?? '',
      }
      await checkBooking(values)
      return getWorkOrder(await repository.insert(values))
    },

    async update(id: string, changes: WorkOrderUpdate): Promise<WorkOrder> {
      const order = await editableWorkOrder(id)
      const values: WorkOrderValues = {
        vehicleId: changes.vehicleId ?? order.vehicle.id,
        kind: changes.kind ?? order.kind,
        startsAt: changes.startsAt ? new Date(changes.startsAt) : order.startsAt,
        endsAt: changes.endsAt ? new Date(changes.endsAt) : order.endsAt,
        costUah: changes.costUah ?? order.costUah,
        note: changes.note ?? order.note,
      }
      await checkBooking(values, id)
      await repository.update(id, values)
      return getWorkOrder(id)
    },

    async cancel(id: string): Promise<WorkOrder> {
      await editableWorkOrder(id)
      await repository.cancel(id, now())
      return getWorkOrder(id)
    },

    /** Work orders still on that share time with the span, their days' routine services booked first; trips plan around them */
    async listBetween(from: Date, to: Date) {
      await ensurePlanned(daysOf(from, to))
      return repository.listBetween(from, to)
    },
  }
}

export type WorkOrdersService = ReturnType<typeof createWorkOrdersService>
