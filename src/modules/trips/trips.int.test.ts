import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { loadConfig } from '../../config/env.ts'
import { createTestDatabase } from '../../infra/db/test-database.ts'
import { seedDemoData } from '../demo/index.ts'
import { createDriversRepository, createDriversService } from '../drivers/index.ts'
import { createVehiclesRepository, createVehiclesService } from '../vehicles/index.ts'
import { createTripsRepository, type TripsRepository } from './trips.repository.ts'
import { TripListQuerySchema } from './trips.schemas.ts'
import { createTripsService, type TripsService } from './trips.service.ts'

const TODAY = '2026-10-26'
const NOW = new Date('2026-10-26T10:00:00Z') // 12:00 in Kyiv
const MINUTE = 60_000

// Parse like the route does, so defaults (page, pageSize, sort) are filled in
const query = (input: Record<string, unknown> = {}) => TripListQuerySchema.parse(input)

let testDatabase: Awaited<ReturnType<typeof createTestDatabase>>
let repository: TripsRepository
let service: TripsService

beforeAll(async () => {
  testDatabase = await createTestDatabase(loadConfig().databaseUrl)
  const { db } = testDatabase.database
  await seedDemoData(db, { seed: 42, today: new Date(TODAY) })

  repository = createTripsRepository(db)
  service = createTripsService({
    repository,
    listVehicles: createVehiclesService({ repository: createVehiclesRepository(db) })
      .listWithDepots,
    listDrivers: createDriversService({ repository: createDriversRepository(db) }).listForPlanning,
    now: () => NOW,
  })
})

afterAll(() => testDatabase?.drop())

describe('trips', () => {
  it('plans a day the first time it is asked for, and only once', async () => {
    const first = await service.list(query({ day: TODAY }))
    const again = await service.list(query({ day: TODAY }))

    expect(first.total).toBeGreaterThan(40)
    expect(again.total).toBe(first.total)
  })

  it('filters by status on the same clock the trips show', async () => {
    const totals = await Promise.all(
      ['planned', 'in_progress', 'completed'].map(async (status) => {
        const page = await service.list(query({ day: TODAY, status, pageSize: 100 }))
        expect(page.items.every((trip) => trip.status === status)).toBe(true)
        return page.total
      }),
    )
    const everything = await service.list(query({ day: TODAY }))

    expect(totals.reduce((sum, total) => sum + total)).toBe(everything.total)
  })

  it('never puts a vehicle or a driver on two trips at once, whoever books them', async () => {
    const [trip] = (await service.list(query({ day: TODAY }))).items
    const departsAt = new Date(Date.parse(trip!.departsAt) + 10 * MINUTE)

    const added = await repository.addPlannedDay('2026-12-31', [
      {
        vehicleId: trip!.vehicle.id,
        driverId: trip!.driver.id,
        routeId: trip!.route.id,
        departsAt,
        returnsAt: new Date(departsAt.getTime() + 60 * MINUTE),
      },
    ])

    expect(added).toBe(0)
  })
})
