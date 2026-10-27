/**
 * The whole database schema in one place: each module's `*.table.ts` is re-exported here,
 * so typed queries and drizzle-kit (migrations) both see every table.
 */
export * from '../../modules/depots/depots.table.ts'
export * from '../../modules/drivers/drivers.table.ts'
export * from '../../modules/trips/trips.table.ts'
export * from '../../modules/vehicles/vehicles.table.ts'
