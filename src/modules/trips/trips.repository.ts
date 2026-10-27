import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  isNotNull,
  isNull,
  lt,
  lte,
  type SQL,
} from 'drizzle-orm'

import type { Db } from '../../infra/db/client.ts'
import { pageOffset, parseSort } from '../../shared/http/pagination.ts'
import type { IsoDate } from '../../shared/time/fleet-time.ts'
import { drivers } from '../drivers/drivers.table.ts'
import { vehicles } from '../vehicles/vehicles.table.ts'
import type { PlannedTrip } from './domain/timetable.ts'
import type { TripStatus } from './domain/trip-status.ts'
import type { TripListQuery } from './trips.schemas.ts'
import { scheduleDays, trips } from './trips.table.ts'

/** No trip lasts longer than this, so a search for trips around a moment can skip older ones */
const LONGEST_TRIP_MS = 12 * 60 * 60_000

const tripFields = {
  id: trips.id,
  number: trips.number,
  routeId: trips.routeId,
  departsAt: trips.departsAt,
  returnsAt: trips.returnsAt,
  cancelledAt: trips.cancelledAt,
  vehicle: { id: vehicles.id, plate: vehicles.plate, type: vehicles.type },
  driver: { id: drivers.id, firstName: drivers.firstName, lastName: drivers.lastName },
}

const SORT_COLUMNS = { departsAt: trips.departsAt, number: trips.number }

/** The rule of tripStatus(), written for the database to filter by */
function statusFilter(status: TripStatus, now: Date): SQL | undefined {
  switch (status) {
    case 'cancelled':
      return isNotNull(trips.cancelledAt)
    case 'planned':
      return and(isNull(trips.cancelledAt), gt(trips.departsAt, now))
    case 'in_progress':
      return and(isNull(trips.cancelledAt), lte(trips.departsAt, now), gt(trips.returnsAt, now))
    case 'completed':
      return and(isNull(trips.cancelledAt), lte(trips.returnsAt, now))
  }
}

export function createTripsRepository(db: Db) {
  const selectTrips = () =>
    db
      .select(tripFields)
      .from(trips)
      .innerJoin(vehicles, eq(vehicles.id, trips.vehicleId))
      .innerJoin(drivers, eq(drivers.id, trips.driverId))

  return {
    /** Trips that leave within `departing`, the status worked out at `now` */
    async list(query: TripListQuery, departing: { from: Date; to: Date }, now: Date) {
      const where = and(
        gte(trips.departsAt, departing.from),
        lt(trips.departsAt, departing.to),
        query.status ? statusFilter(query.status, now) : undefined,
        query.vehicleId ? eq(trips.vehicleId, query.vehicleId) : undefined,
        query.driverId ? eq(trips.driverId, query.driverId) : undefined,
      )
      const { field, descending } = parseSort(query.sort)
      const sortColumn = SORT_COLUMNS[field]

      const [items, totals] = await Promise.all([
        selectTrips()
          .where(where)
          // Trip numbers are unique, so trips leaving at the same minute keep their order
          .orderBy(descending ? desc(sortColumn) : asc(sortColumn), asc(trips.number))
          .limit(query.pageSize)
          .offset(pageOffset(query)),
        db.select({ total: count() }).from(trips).where(where),
      ])

      return { items, total: totals[0]?.total ?? 0 }
    },

    async findById(id: string) {
      const [trip] = await selectTrips().where(eq(trips.id, id))
      return trip
    },

    /** Trips still on (not cancelled) that overlap the span from `from` to `to`, for every vehicle */
    async listOverlapping(from: Date, to: Date) {
      return db
        .select({
          vehicleId: trips.vehicleId,
          routeId: trips.routeId,
          departsAt: trips.departsAt,
          returnsAt: trips.returnsAt,
        })
        .from(trips)
        .where(
          and(
            isNull(trips.cancelledAt),
            gte(trips.departsAt, new Date(from.getTime() - LONGEST_TRIP_MS)),
            lt(trips.departsAt, to),
            gt(trips.returnsAt, from),
          ),
        )
    },

    /** Whether the day's usual timetable is already in */
    async isPlanned(day: IsoDate) {
      const [planned] = await db
        .select({ day: scheduleDays.day })
        .from(scheduleDays)
        .where(eq(scheduleDays.day, day))
      return planned !== undefined
    },

    /**
     * Adds a day's usual trips, once: the first caller claims the day and inserts them, and
     * anyone at the same moment waits for it, then finds the day taken. A planned trip that
     * would overlap one already booked is left out by the database. Returns how many were added.
     */
    async addPlannedDay(day: IsoDate, planned: PlannedTrip[]) {
      return db.transaction(async (tx) => {
        const claimed = await tx
          .insert(scheduleDays)
          .values({ day })
          .onConflictDoNothing()
          .returning()
        if (claimed.length === 0 || planned.length === 0) return 0

        const added = await tx
          .insert(trips)
          .values(planned)
          .onConflictDoNothing()
          .returning({ id: trips.id })
        return added.length
      })
    },
  }
}

export type TripsRepository = ReturnType<typeof createTripsRepository>

/** A trip as stored, before its status and times are worked out */
export type TripRow = NonNullable<Awaited<ReturnType<TripsRepository['findById']>>>
