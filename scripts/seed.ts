import { loadConfig } from '../src/config/env.ts'
import { createDatabase } from '../src/infra/db/client.ts'
import { seedDemoData } from '../src/modules/demo/index.ts'

// Wipes the fleet tables and loads a fresh demo set (`npm run db:seed`)
const config = loadConfig()
if (config.env === 'production' && !process.argv.includes('--force')) {
  console.error('Refusing to wipe a production database. Pass --force if you really mean it.')
  process.exit(1)
}

const database = createDatabase(config.databaseUrl)
try {
  const counts = await seedDemoData(database.db)
  console.log(
    `Demo data ready: ${counts.depots} depots, ${counts.vehicles} vehicles, ${counts.drivers} drivers`,
  )
} finally {
  await database.close()
}
