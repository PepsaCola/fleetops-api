import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { loadConfig } from '../../config/env.ts'
import { createTestDatabase } from '../../infra/db/test-database.ts'
import { seedDemoData } from '../demo/index.ts'
import { createVehiclesRepository, type VehiclesRepository } from './vehicles.repository.ts'
import { VehicleListQuerySchema } from './vehicles.schemas.ts'

// Parse like the route does, so defaults (page, pageSize, sort) are filled in
const query = (input: Record<string, unknown> = {}) => VehicleListQuerySchema.parse(input)

let testDatabase: Awaited<ReturnType<typeof createTestDatabase>>
let repository: VehiclesRepository

beforeAll(async () => {
  testDatabase = await createTestDatabase(loadConfig().databaseUrl)
  await seedDemoData(testDatabase.database.db, { seed: 42, today: new Date('2026-10-26') })
  repository = createVehiclesRepository(testDatabase.database.db)
})

afterAll(() => testDatabase?.drop())

describe('vehicles repository', () => {
  it('pages through the whole fleet without gaps or repeats', async () => {
    const pages = await Promise.all(
      [1, 2, 3].map((page) => repository.list(query({ page, pageSize: 15 }))),
    )
    const ids = pages.flatMap((page) => page.items.map((vehicle) => vehicle.id))

    expect(pages.map((page) => page.items.length)).toEqual([15, 15, 10])
    expect(new Set(ids).size).toBe(40)
    expect(pages.every((page) => page.total === 40)).toBe(true)
  })

  it('combines filters and counts only the matching vehicles', async () => {
    const { items, total } = await repository.list(
      query({ type: 'truck', status: 'active', pageSize: 100 }),
    )

    expect(total).toBeGreaterThan(0)
    expect(total).toBe(items.length)
    expect(items.every((vehicle) => vehicle.type === 'truck' && vehicle.status === 'active')).toBe(
      true,
    )
  })

  it('finds a plate typed without spaces, in any case', async () => {
    const [someVehicle] = (await repository.list(query())).items
    const typed = someVehicle!.plate.replaceAll(' ', '').toLowerCase()

    const { items } = await repository.list(query({ search: typed }))

    expect(items.map((vehicle) => vehicle.plate)).toContain(someVehicle!.plate)
  })

  it('treats LIKE wildcards in a search as plain text', async () => {
    const { total } = await repository.list(query({ search: '%' }))

    expect(total).toBe(0)
  })

  it('sorts by odometer, highest first', async () => {
    const { items } = await repository.list(query({ sort: '-odometerKm', pageSize: 100 }))
    const odometers = items.map((vehicle) => vehicle.odometerKm)

    expect(odometers).toEqual([...odometers].sort((a, b) => b - a))
  })

  it('loads a vehicle with its home depot, and nothing for an unknown id', async () => {
    const [someVehicle] = (await repository.list(query())).items

    const found = await repository.findById(someVehicle!.id)
    const missing = await repository.findById('0199d2a4-5f3e-7c11-9a2b-3c4d5e6f7a8b')

    expect(found).toEqual(someVehicle)
    expect(found?.homeDepot.name).toBeTruthy()
    expect(missing).toBeUndefined()
  })

  it('lists every vehicle with the location of its home depot', async () => {
    const fleet = await repository.listWithDepots()

    expect(fleet).toHaveLength(40)
    expect(fleet[0]?.homeDepot.location).toEqual({
      lng: expect.any(Number),
      lat: expect.any(Number),
    })
  })
})
