import { sql } from 'drizzle-orm'

import type { Db } from '../../infra/db/client.ts'
import { depots } from '../depots/depots.table.ts'
import { drivers } from '../drivers/drivers.table.ts'
import { vehicles } from '../vehicles/vehicles.table.ts'
import { generateDemoData } from './demo-data.ts'

/**
 * Replaces everything in the fleet tables with a fresh demo set, in one transaction:
 * either the whole demo is in place or nothing changed.
 */
export async function seedDemoData(db: Db, options?: Parameters<typeof generateDemoData>[0]) {
  const data = generateDemoData(options)

  return db.transaction(async (tx) => {
    await tx.execute(sql`truncate table ${drivers}, ${vehicles}, ${depots} cascade`)

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
      depots: data.depots.length,
      vehicles: data.vehicles.length,
      drivers: data.drivers.length,
    }
  })
}
