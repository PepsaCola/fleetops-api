import { migrate } from 'drizzle-orm/postgres-js/migrator'

import { loadConfig } from '../../config/env.ts'
import { createDatabase } from './client.ts'

// Applies every migration in ./drizzle that the database hasn't seen yet (`npm run db:migrate`)
const database = createDatabase(loadConfig().databaseUrl)
try {
  await migrate(database.db, { migrationsFolder: 'drizzle' })
  console.log('Migrations applied')
} finally {
  await database.close()
}
