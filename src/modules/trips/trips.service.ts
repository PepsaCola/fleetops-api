import { ConflictError, NotFoundError, UnprocessableError } from '../../shared/errors.ts'
import {
  addDays,
  daysFrom,
  fleetInstant,
  fleetToday,
  type IsoDate,
} from '../../shared/time/fleet-time.ts'
import { DEMO_ROUTES, prepareRoute, type DemoRoute } from '../tracking/index.ts'
import { bookingProblem } from './domain/booking.ts'
import {
  planDay,
  type PlannedTrip,
  type PlanningDriver,
  type PlanningVehicle,
} from './domain/timetable.ts'
import { tripStatus, type TripStatus } from './domain/trip-status.ts'
import type { TripRow, TripsRepository } from './trips.repository.ts'
import type { Trip, TripCreate, TripListQuery, TripPage, TripUpdate } from './trips.schemas.ts'

/** A work order as trips see it: a vehicle out of reach for a while */
export type WorkshopVisit = { vehicleId: string; number: number; startsAt: Date; endsAt: Date }

type Dependencies = {
  repository: TripsRepository
  /** The vehicles and drivers modules supply who could work; days are planned from them */
  listVehicles: () => Promise<PlanningVehicle[]>
  listDrivers: () => Promise<PlanningDriver[]>
  /** The maintenance module: work orders still on that share time with the span */
  listWorkOrders: (from: Date, to: Date) => Promise<WorkshopVisit[]>
  routes?: DemoRoute[]
  /** The current time; tests pass a fixed one */
  now?: () => Date
}

/** A trip as a dispatcher books it; when it is back follows from the route */
type Booking = Omit<PlannedTrip, 'returnsAt'>

/** Days are planned on demand only this close to today, so a stray request can't fill years */
const PLANNING_WINDOW = { pastDays: 31, futureDays: 14 }

const NOT_EDITABLE: Record<Exclude<TripStatus, 'planned'>, string> = {
  in_progress: 'on the road',
  completed: 'completed',
  cancelled: 'cancelled',
}

/** Whether a work order keeps a trip's vehicle in the workshop during the trip */
const keepsFrom = (trip: PlannedTrip) => (visit: WorkshopVisit) =>
  visit.vehicleId === trip.vehicleId &&
  visit.startsAt < trip.returnsAt &&
  trip.departsAt < visit.endsAt

export function createTripsService({
  repository,
  listVehicles,
  listDrivers,
  listWorkOrders,
  routes = DEMO_ROUTES,
  now = () => new Date(),
}: Dependencies) {
  const prepared = new Map(routes.map((route) => [route.id, prepareRoute(route)]))

  const toTrip =
    (at: Date) =>
    (row: TripRow): Trip => {
      const route = prepared.get(row.routeId)
      if (!route) throw new Error(`Trip ${row.number} is on an unknown route "${row.routeId}"`)
      return {
        id: row.id,
        number: row.number,
        status: tripStatus(row, at),
        vehicle: row.vehicle,
        driver: row.driver,
        route: { id: route.id, name: route.name, kind: route.kind },
        departsAt: row.departsAt.toISOString(),
        arrivesAt: new Date(row.departsAt.getTime() + route.driveMs).toISOString(),
        returnsAt: row.returnsAt.toISOString(),
        cancelledAt: row.cancelledAt?.toISOString() ?? null,
      }
    }

  async function getTrip(id: string): Promise<Trip> {
    const trip = await repository.findById(id)
    if (!trip) throw new NotFoundError('Trip', id)
    return toTrip(now())(trip)
  }

  /** Makes sure the day's usual timetable is in place before anyone looks at the day. */
  async function ensurePlanned(day: IsoDate) {
    const today = fleetToday(now())
    const tooFar =
      day < addDays(today, -PLANNING_WINDOW.pastDays) ||
      day > addDays(today, PLANNING_WINDOW.futureDays)
    if (tooFar || (await repository.isPlanned(day))) return

    // The day's trips leave that day and are back by midday the next; the workshop comes first
    const [vehicles, drivers, workshop] = await Promise.all([
      listVehicles(),
      listDrivers(),
      listWorkOrders(fleetInstant(day, 0), fleetInstant(addDays(day, 1), 12 * 60)),
    ])
    const planned = planDay(day, { vehicles, drivers, routes: [...prepared.values()] }).filter(
      (trip) => !workshop.some(keepsFrom(trip)),
    )
    await repository.addPlannedDay(day, planned)
  }

  /** The trip, if it can still be changed: once it has left, it is history. */
  async function editableTrip(id: string) {
    const trip = await repository.findById(id)
    if (!trip) throw new NotFoundError('Trip', id)
    const status = tripStatus(trip, now())
    if (status !== 'planned') {
      throw new ConflictError(
        'TRIP_NOT_EDITABLE',
        `Trip ${trip.number} is ${NOT_EDITABLE[status]} and can no longer be changed`,
      )
    }
    return trip
  }

  /** Checks a booking against the fleet's rules, the workshop and the trips already booked; `exceptId` is the trip being changed. */
  async function checkBooking(booking: Booking, exceptId?: string): Promise<PlannedTrip> {
    const route = prepared.get(booking.routeId)
    if (!route)
      throw new UnprocessableError('UNKNOWN_ROUTE', `There is no route "${booking.routeId}"`)
    // A fleet of a few dozen vehicles and drivers: looking them up in the full lists is cheap
    const [vehicles, drivers] = await Promise.all([listVehicles(), listDrivers()])
    const vehicle = vehicles.find((candidate) => candidate.id === booking.vehicleId)
    if (!vehicle) {
      throw new UnprocessableError('UNKNOWN_VEHICLE', `There is no vehicle ${booking.vehicleId}`)
    }
    const driver = drivers.find((candidate) => candidate.id === booking.driverId)
    if (!driver) {
      throw new UnprocessableError('UNKNOWN_DRIVER', `There is no driver ${booking.driverId}`)
    }

    const returnsAt = new Date(booking.departsAt.getTime() + route.roundTripMs)
    const problem = bookingProblem(
      { vehicle, driver, route, departsAt: booking.departsAt, returnsAt },
      [...prepared.values()],
      now(),
    )
    if (problem) throw new UnprocessableError(problem.code, problem.message)

    // The usual trips of those days go in first, so the booking is checked against them too
    const day = fleetToday(booking.departsAt)
    await ensurePlanned(addDays(day, -1))
    await ensurePlanned(day)

    const planned = { ...booking, returnsAt }
    const visits = (await listWorkOrders(booking.departsAt, returnsAt)).filter(
      (visit) => visit.vehicleId === booking.vehicleId,
    )
    const [visit] = visits
    if (visit) {
      throw new ConflictError(
        'VEHICLE_IN_WORKSHOP',
        `The vehicle is in the workshop then (work order ${visit.number})`,
        { workOrders: visits.map(({ number }) => number) },
      )
    }

    const clashes = await repository.findClashes(planned, exceptId)
    const [first] = clashes
    if (first) {
      const vehicleClash = clashes.find((clash) => clash.vehicleId === booking.vehicleId)
      throw new ConflictError(
        'TRIP_OVERLAP',
        vehicleClash
          ? `The vehicle is on trip ${vehicleClash.number} at that time`
          : `The driver is on trip ${first.number} at that time`,
        { trips: clashes.map((clash) => clash.number) },
      )
    }
    return planned
  }

  return {
    ensurePlanned,

    async list(query: TripListQuery): Promise<TripPage> {
      const at = now()
      const day = query.day ?? fleetToday(at)
      // The day before first: its late truck shifts run on into this one
      await ensurePlanned(addDays(day, -1))
      await ensurePlanned(day)

      const departing = { from: fleetInstant(day, 0), to: fleetInstant(addDays(day, 1), 0) }
      const { items, total } = await repository.list(query, departing, at)
      return { items: items.map(toTrip(at)), total, page: query.page, pageSize: query.pageSize }
    },

    get: getTrip,

    async create(input: TripCreate): Promise<Trip> {
      const booking = await checkBooking({ ...input, departsAt: new Date(input.departsAt) })
      return getTrip(await repository.insert(booking))
    },

    async update(id: string, changes: TripUpdate): Promise<Trip> {
      const trip = await editableTrip(id)
      const booking = await checkBooking(
        {
          vehicleId: changes.vehicleId ?? trip.vehicle.id,
          driverId: changes.driverId ?? trip.driver.id,
          routeId: changes.routeId ?? trip.routeId,
          departsAt: changes.departsAt ? new Date(changes.departsAt) : trip.departsAt,
        },
        id,
      )
      await repository.update(id, booking)
      return getTrip(id)
    },

    async cancel(id: string): Promise<Trip> {
      await editableTrip(id)
      await repository.cancel(id, now())
      return getTrip(id)
    },

    /** Trips still on that overlap the span, the days around it planned first; the map places vehicles from them */
    async listOverlapping(from: Date, to: Date) {
      const days = new Set([addDays(fleetToday(from), -1), fleetToday(from), fleetToday(to)])
      await Promise.all([...days].map((day) => ensurePlanned(day)))
      return repository.listOverlapping(from, to)
    },

    /** Trips still on that leave on the days from `first` to `last`, each day planned first; costs add them up */
    async listOnDays(first: IsoDate, last: IsoDate) {
      await Promise.all(daysFrom(first, last).map((day) => ensurePlanned(day)))
      const trips = await repository.listOverlapping(
        fleetInstant(first, 0),
        fleetInstant(addDays(last, 1), 0),
      )
      // Overlapping takes in last night's runs too; a trip belongs to the day it leaves
      return trips.filter((trip) => fleetToday(trip.departsAt) >= first)
    },
  }
}

export type TripsService = ReturnType<typeof createTripsService>
