import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

import { createDatabase } from './client.ts'

const connectToServer = (serverUrl: string) => postgres(serverUrl, { max: 1, onnotice: () => {} })

/**
 * A throwaway database for integration tests: created on the same Postgres server as
 * `serverUrl`, migrated to the latest schema and dropped afterwards, so tests never see
 * or change the development data.
 */
export async function createTestDatabase(serverUrl: string) {
  const name = `fleetops_test_${process.pid}_${Date.now()}`

  const server = connectToServer(serverUrl)
  await server.unsafe(`create database "${name}"`)
  await server.end()

  const url = new URL(serverUrl)
  url.pathname = `/${name}`
  const database = createDatabase(url.toString())
  await migrate(database.db, { migrationsFolder: 'drizzle' })

  return {
    database,
    async drop() {
      await database.close()
      const cleanup = connectToServer(serverUrl)
      await cleanup.unsafe(`drop database if exists "${name}" with (force)`)
      await cleanup.end()
    },
  }
}
