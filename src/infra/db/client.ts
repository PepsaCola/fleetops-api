import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema.ts'

/**
 * One connection pool for the whole process. postgres.js connects lazily, on the first query,
 * so building the app (e.g. in tests or the OpenAPI export) doesn't need a running database.
 */
export function createDatabase(url: string) {
  const sql = postgres(url, {
    max: 10,
    // Fail fast when the database is down, so /ready answers in seconds instead of hanging
    connect_timeout: 5,
    // Postgres reports harmless NOTICEs (e.g. "extension already exists"); keep them out of logs
    onnotice: () => {},
  })
  const db = drizzle({ client: sql, schema, casing: 'snake_case' })

  return {
    db,
    /** Readiness check: one round-trip to the database. */
    ping: async () => {
      await sql`select 1`
    },
    close: () => sql.end({ timeout: 5 }),
  }
}

export type Database = ReturnType<typeof createDatabase>
/** The typed Drizzle query builder that repositories receive. */
export type Db = Database['db']
