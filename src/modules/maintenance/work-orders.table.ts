import { sql } from 'drizzle-orm'
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import { id, timestamps } from '../../infra/db/columns.ts'
import { vehicles } from '../vehicles/vehicles.table.ts'

export const workOrderKind = pgEnum('work_order_kind', ['service', 'repair', 'inspection', 'tyres'])

// A vehicle is in the workshop for one work order at a time. Drizzle can't declare that kind of
// constraint, so it lives in a hand-written migration (drizzle/0006_work_orders_no_overlap.sql),
// whose GiST index also serves lookups by vehicle.

export const workOrders = pgTable(
  'work_orders',
  {
    id: id(),
    /** A short number for the workshop's paperwork; ids are far too long for that */
    number: integer().generatedAlwaysAsIdentity({ startWith: 5001 }),
    vehicleId: uuid()
      .notNull()
      .references(() => vehicles.id),
    kind: workOrderKind().notNull(),
    /** In the workshop from… */
    startsAt: timestamp({ withTimezone: true }).notNull(),
    /** …until; no trips for the vehicle in between */
    endsAt: timestamp({ withTimezone: true }).notNull(),
    /** What the work costs, in whole hryvnias */
    costUah: integer().notNull(),
    note: text().notNull().default(''),
    /** A cancelled work order stays on record but no longer holds the vehicle */
    cancelledAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index().on(table.startsAt),
    check('work_orders_ends_after_start', sql`${table.endsAt} > ${table.startsAt}`),
    check('work_orders_cost_not_negative', sql`${table.costUah} >= 0`),
  ],
)

/** Days whose routine services are already booked: each day is planned once, whatever happens to its work orders later */
export const workshopDays = pgTable('workshop_days', {
  day: date().primaryKey(),
  plannedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
