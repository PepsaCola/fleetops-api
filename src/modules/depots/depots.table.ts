import { index, pgTable, text } from 'drizzle-orm/pg-core'

import { geoPoint, id, timestamps } from '../../infra/db/columns.ts'

/** Bases the fleet starts from and returns to. */
export const depots = pgTable(
  'depots',
  {
    id: id(),
    name: text().notNull().unique(),
    address: text().notNull(),
    location: geoPoint().notNull(),
    ...timestamps,
  },
  (table) => [index().using('gist', table.location)],
)
