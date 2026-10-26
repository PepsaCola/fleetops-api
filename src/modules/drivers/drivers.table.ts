import { date, index, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core'

import { id, timestamps } from '../../infra/db/columns.ts'
import { depots } from '../depots/depots.table.ts'

export const driverStatus = pgEnum('driver_status', ['active', 'on_leave', 'inactive'])

export const drivers = pgTable(
  'drivers',
  {
    id: id(),
    firstName: text().notNull(),
    lastName: text().notNull(),
    phone: text().notNull().unique(),
    licenseNumber: text().notNull().unique('drivers_license_number_unique'),
    /** Licence categories the driver holds, e.g. ["B", "C", "CE"] */
    licenseCategories: text().array().notNull(),
    // Plain dates (YYYY-MM-DD): an expiry day doesn't depend on a time zone
    licenseExpiresOn: date().notNull(),
    medicalExpiresOn: date().notNull(),
    status: driverStatus().notNull().default('active'),
    homeDepotId: uuid()
      .notNull()
      .references(() => depots.id),
    ...timestamps,
  },
  (table) => [index().on(table.homeDepotId), index().on(table.status)],
)
