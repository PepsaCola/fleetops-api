import { sql } from 'drizzle-orm'
import { check, date, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { id, timestamps } from '../../infra/db/columns.ts'
import { drivers } from '../drivers/drivers.table.ts'
import { vehicles } from '../vehicles/vehicles.table.ts'

// A vehicle or a driver is never on two trips at once. Drizzle can't declare that kind of
// constraint, so it lives in a hand-written migration (drizzle/0003_trips_no_overlap.sql),
// whose GiST indexes also serve lookups by vehicle and by driver.

export const trips = pgTable(
  'trips',
  {
    id: id(),
    /** A short number people can read out on the phone; ids are far too long for that */
    number: integer().generatedAlwaysAsIdentity({ startWith: 1001 }),
    vehicleId: uuid()
      .notNull()
      .references(() => vehicles.id),
    driverId: uuid()
      .notNull()
      .references(() => drivers.id),
    /** One of the demo routes; they live in code, not in the database */
    routeId: text().notNull(),
    /** Leaves the depot */
    departsAt: timestamp({ withTimezone: true }).notNull(),
    /** Back at the depot after the customer */
    returnsAt: timestamp({ withTimezone: true }).notNull(),
    /** A cancelled trip stays on record but no longer holds the vehicle or the driver */
    cancelledAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index().on(table.departsAt),
    check('trips_returns_after_departure', sql`${table.returnsAt} > ${table.departsAt}`),
  ],
)

/** Days whose usual timetable is already planned: each day is planned once, whatever happens to its trips later */
export const scheduleDays = pgTable('schedule_days', {
  day: date().primaryKey(),
  plannedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
