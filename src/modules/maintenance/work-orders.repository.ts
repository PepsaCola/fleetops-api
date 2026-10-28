import { and, asc, eq, gt, gte, isNotNull, isNull, lt, lte, ne, type SQL } from 'drizzle-orm'

import type { Db } from '../../infra/db/client.ts'
import { refusingOverlap } from '../../infra/db/exclusion.ts'
import { ConflictError } from '../../shared/errors.ts'
import type { IsoDate } from '../../shared/time/fleet-time.ts'
import { vehicles } from '../vehicles/vehicles.table.ts'
import type { WorkOrderStatus } from './domain/work-order-status.ts'
import type { WorkOrderKind } from './work-orders.schemas.ts'
import { workOrders, workshopDays } from './work-orders.table.ts'

/** A work order as it's written */
export type WorkOrderValues = {
  vehicleId: string
  kind: WorkOrderKind
  startsAt: Date
  endsAt: Date
  costUah: number
  note: string
}

const workOrderFields = {
  id: workOrders.id,
  number: workOrders.number,
  kind: workOrders.kind,
  startsAt: workOrders.startsAt,
  endsAt: workOrders.endsAt,
  costUah: workOrders.costUah,
  note: workOrders.note,
  cancelledAt: workOrders.cancelledAt,
  vehicle: { id: vehicles.id, plate: vehicles.plate, type: vehicles.type },
}

/** The rule of workOrderStatus(), written for the database to filter by */
function statusFilter(status: WorkOrderStatus, now: Date): SQL | undefined {
  switch (status) {
    case 'cancelled':
      return isNotNull(workOrders.cancelledAt)
    case 'scheduled':
      return and(isNull(workOrders.cancelledAt), gt(workOrders.startsAt, now))
    case 'in_progress':
      return and(
        isNull(workOrders.cancelledAt),
        lte(workOrders.startsAt, now),
        gt(workOrders.endsAt, now),
      )
    case 'done':
      return and(isNull(workOrders.cancelledAt), lte(workOrders.endsAt, now))
  }
}

/** Still on (not cancelled) and sharing time with the span from `from` to `to` */
const holdsTimeIn = (from: Date, to: Date) =>
  and(isNull(workOrders.cancelledAt), lt(workOrders.startsAt, to), gt(workOrders.endsAt, from))

const overlapRefused = () =>
  new ConflictError(
    'WORKSHOP_OVERLAP',
    'The vehicle was booked into the workshop for that time a moment ago',
  )

export function createWorkOrdersRepository(db: Db) {
  const selectWorkOrders = () =>
    db
      .select(workOrderFields)
      .from(workOrders)
      .innerJoin(vehicles, eq(vehicles.id, workOrders.vehicleId))

  return {
    /** Work orders that share time with the span from `from` to `to`, by start; the status worked out at `now` */
    async list(
      filter: { from: Date; to: Date; vehicleId?: string; status?: WorkOrderStatus },
      now: Date,
    ) {
      return selectWorkOrders()
        .where(
          and(
            lt(workOrders.startsAt, filter.to),
            gt(workOrders.endsAt, filter.from),
            filter.vehicleId ? eq(workOrders.vehicleId, filter.vehicleId) : undefined,
            filter.status ? statusFilter(filter.status, now) : undefined,
          ),
        )
        .orderBy(asc(workOrders.startsAt), asc(workOrders.number))
    },

    async findById(id: string) {
      const [order] = await selectWorkOrders().where(eq(workOrders.id, id))
      return order
    },

    /** Work orders still on that share time with the span, for every vehicle */
    async listBetween(from: Date, to: Date) {
      return db
        .select({
          vehicleId: workOrders.vehicleId,
          number: workOrders.number,
          startsAt: workOrders.startsAt,
          endsAt: workOrders.endsAt,
        })
        .from(workOrders)
        .where(holdsTimeIn(from, to))
    },

    /** The vehicle's work orders still on that share time with the span; `exceptId` is the one being changed */
    async listOverlapping(vehicleId: string, from: Date, to: Date, exceptId?: string) {
      return db
        .select({
          number: workOrders.number,
          startsAt: workOrders.startsAt,
          endsAt: workOrders.endsAt,
        })
        .from(workOrders)
        .where(
          and(
            eq(workOrders.vehicleId, vehicleId),
            holdsTimeIn(from, to),
            exceptId ? ne(workOrders.id, exceptId) : undefined,
          ),
        )
        .orderBy(asc(workOrders.startsAt))
    },

    /** Saves a new work order and returns its id */
    async insert(values: WorkOrderValues) {
      const [added] = await refusingOverlap(
        db.insert(workOrders).values(values).returning({ id: workOrders.id }),
        overlapRefused,
      )
      if (!added) throw new Error('The work order was not saved')
      return added.id
    },

    async update(id: string, values: WorkOrderValues) {
      await refusingOverlap(
        db.update(workOrders).set(values).where(eq(workOrders.id, id)),
        overlapRefused,
      )
    },

    async cancel(id: string, at: Date) {
      await db.update(workOrders).set({ cancelledAt: at }).where(eq(workOrders.id, id))
    },

    /** Which of the days from `first` to `last` already have their routine services booked */
    async plannedDays(first: IsoDate, last: IsoDate) {
      const rows = await db
        .select({ day: workshopDays.day })
        .from(workshopDays)
        .where(and(gte(workshopDays.day, first), lte(workshopDays.day, last)))
      return new Set(rows.map(({ day }) => day))
    },

    /**
     * Books a day's routine services, once: the first caller claims the day, anyone at the same
     * moment finds it taken. A service that would overlap a work order already booked is left
     * out by the database. Returns how many were added.
     */
    async addPlannedDay(day: IsoDate, orders: WorkOrderValues[]) {
      return db.transaction(async (tx) => {
        const claimed = await tx
          .insert(workshopDays)
          .values({ day })
          .onConflictDoNothing()
          .returning()
        if (claimed.length === 0 || orders.length === 0) return 0

        const added = await tx
          .insert(workOrders)
          .values(orders)
          .onConflictDoNothing()
          .returning({ id: workOrders.id })
        return added.length
      })
    },
  }
}

export type WorkOrdersRepository = ReturnType<typeof createWorkOrdersRepository>

/** A work order as stored, before its status is worked out */
export type WorkOrderRow = NonNullable<Awaited<ReturnType<WorkOrdersRepository['findById']>>>
