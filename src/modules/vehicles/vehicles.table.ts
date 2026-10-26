import { index, integer, pgEnum, pgTable, smallint, text, uuid } from 'drizzle-orm/pg-core'

import { id, timestamps } from '../../infra/db/columns.ts'
import { depots } from '../depots/depots.table.ts'

export const vehicleType = pgEnum('vehicle_type', ['truck', 'van', 'car'])
export const vehicleStatus = pgEnum('vehicle_status', ['active', 'maintenance', 'inactive'])

export const vehicles = pgTable(
  'vehicles',
  {
    id: id(),
    /** Ukrainian number plate, e.g. "AA 1234 KB" */
    plate: text().notNull().unique(),
    make: text().notNull(),
    model: text().notNull(),
    year: smallint().notNull(),
    type: vehicleType().notNull(),
    status: vehicleStatus().notNull().default('active'),
    capacityKg: integer().notNull(),
    fuelTankL: integer().notNull(),
    odometerKm: integer().notNull(),
    homeDepotId: uuid()
      .notNull()
      .references(() => depots.id),
    ...timestamps,
  },
  (table) => [index().on(table.homeDepotId), index().on(table.status)],
)
