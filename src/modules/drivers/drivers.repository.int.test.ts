import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { loadConfig } from '../../config/env.ts'
import { createTestDatabase } from '../../infra/db/test-database.ts'
import { seedDemoData } from '../demo/index.ts'
import {
  DOCUMENT_STATES,
  documentState,
  documentsExpireOn,
  expiryRange,
} from './domain/documents.ts'
import { createDriversRepository, type DriversRepository } from './drivers.repository.ts'
import { DriverListQuerySchema } from './drivers.schemas.ts'

const TODAY = '2026-10-26'

// Parse like the route does, so defaults (page, pageSize, sort) are filled in
const query = (input: Record<string, unknown> = {}) => DriverListQuerySchema.parse(input)

let testDatabase: Awaited<ReturnType<typeof createTestDatabase>>
let repository: DriversRepository

beforeAll(async () => {
  testDatabase = await createTestDatabase(loadConfig().databaseUrl)
  await seedDemoData(testDatabase.database.db, { seed: 42, today: new Date(TODAY) })
  repository = createDriversRepository(testDatabase.database.db)
})

afterAll(() => testDatabase?.drop())

describe('drivers repository', () => {
  it('pages through every driver without gaps or repeats', async () => {
    const pages = await Promise.all([1, 2, 3].map((page) => repository.list(query({ page }))))
    const ids = pages.flatMap((page) => page.items.map((driver) => driver.id))

    expect(pages.map((page) => page.items.length)).toEqual([20, 20, 15])
    expect(new Set(ids).size).toBe(55)
  })

  it('finds a driver by "first last", "last first", phone or licence number', async () => {
    const [someone] = (await repository.list(query())).items
    const phoneAsTyped = someone!.phone.replace('+38', '').replace(/(\d{3})(\d{3})/, '$1 $2 ')

    const searches = {
      firstLast: `${someone!.firstName} ${someone!.lastName}`,
      lastFirst: `${someone!.lastName} ${someone!.firstName}`.toLowerCase(),
      phone: phoneAsTyped,
      license: someone!.licenseNumber,
    }

    const found = await Promise.all(
      Object.values(searches).map(async (search) => {
        const { items } = await repository.list(query({ search }))
        return items.some((driver) => driver.id === someone!.id)
      }),
    )

    expect(found).toEqual([true, true, true, true])
  })

  it('filters by the same expiry ranges the documents state is worked out from', async () => {
    const pages = await Promise.all(
      DOCUMENT_STATES.map((state) =>
        repository.list(query({ pageSize: 100 }), expiryRange(state, TODAY)),
      ),
    )

    DOCUMENT_STATES.forEach((state, index) => {
      const states = pages[index]!.items.map((driver) =>
        documentState(documentsExpireOn(driver), TODAY),
      )
      expect(states.every((each) => each === state)).toBe(true)
    })
    // Every driver is in exactly one state, and the demo data has some expiring next month
    expect(pages.reduce((sum, page) => sum + page.total, 0)).toBe(55)
    expect(pages[DOCUMENT_STATES.indexOf('expiring')]!.total).toBeGreaterThan(0)
  })

  it('sorts by the first document to expire', async () => {
    const { items } = await repository.list(query({ sort: 'documentsExpireOn', pageSize: 100 }))
    const dates = items.map(documentsExpireOn)

    expect(dates).toEqual([...dates].sort())
  })

  it('loads a driver with their depot, and nothing for an unknown id', async () => {
    const [someone] = (await repository.list(query())).items

    expect(await repository.findById(someone!.id)).toEqual(someone)
    expect(await repository.findById('0199d2a4-5f3e-7c11-9a2b-3c4d5e6f7a8b')).toBeUndefined()
  })
})
