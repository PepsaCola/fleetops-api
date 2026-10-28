import { sql } from 'drizzle-orm'

import type { Db } from '../../infra/db/client.ts'
import { sessions, users } from '../auth/auth.table.ts'
import { hashPassword } from '../auth/index.ts'
import { depots } from '../depots/depots.table.ts'
import { drivers } from '../drivers/drivers.table.ts'
import { workOrders, workshopDays } from '../maintenance/work-orders.table.ts'
import { scheduleDays, trips } from '../trips/trips.table.ts'
import { vehicles } from '../vehicles/vehicles.table.ts'
import { generateDemoData } from './demo-data.ts'
import { DEMO_PASSWORD, DEMO_USERS } from './demo-users.ts'

/**
 * Replaces everything in the fleet tables with a fresh demo set, in one transaction:
 * either the whole demo is in place or nothing changed.
 */
export async function seedDemoData(db: Db, options?: Parameters<typeof generateDemoData>[0]) {
  const data = generateDemoData(options)
  // Hashing is slow on purpose, so it happens before the transaction holds any locks
  const demoUsers = await Promise.all(
    DEMO_USERS.map(async (user) => ({ ...user, passwordHash: await hashPassword(DEMO_PASSWORD) })),
  )

  return db.transaction(async (tx) => {
    // Planned days go too, so the timetable and the routine services are planned afresh for the
    // new fleet, and trip and work order numbers start again from the first one. Everyone is
    // signed out.
    await tx.execute(
      sql`truncate table ${sessions}, ${users}, ${scheduleDays}, ${trips}, ${workshopDays}, ${workOrders}, ${drivers}, ${vehicles}, ${depots} restart identity cascade`,
    )

    await tx.insert(users).values(demoUsers)

    const depotIds = (await tx.insert(depots).values(data.depots).returning({ id: depots.id })).map(
      (row) => row.id,
    )
    const depotId = (index: number) => {
      const id = depotIds[index]
      if (!id) throw new Error(`Demo data refers to a missing depot #${index}`)
      return id
    }

    await tx
      .insert(vehicles)
      .values(
        data.vehicles.map(({ depot, ...vehicle }) => ({ ...vehicle, homeDepotId: depotId(depot) })),
      )
    await tx
      .insert(drivers)
      .values(
        data.drivers.map(({ depot, ...driver }) => ({ ...driver, homeDepotId: depotId(depot) })),
      )

    return {
      users: demoUsers.length,
      depots: data.depots.length,
      vehicles: data.vehicles.length,
      drivers: data.drivers.length,
    }
  })
}
