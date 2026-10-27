import { describe, expect, it, vi } from 'vitest'

import { NotFoundError } from '../../shared/errors.ts'
import type { DriverRow, DriversRepository } from './drivers.repository.ts'
import { DriverListQuerySchema } from './drivers.schemas.ts'
import { createDriversService } from './drivers.service.ts'

const DRIVER_ID = '0199d2a4-5f3e-7c11-9a2b-3c4d5e6f7a8b'

const driver: DriverRow = {
  id: DRIVER_ID,
  firstName: 'Olena',
  lastName: 'Kovalenko',
  phone: '+380671234567',
  licenseNumber: 'AKH123456',
  licenseCategories: ['B', 'C', 'CE'],
  licenseExpiresOn: '2029-03-01',
  medicalExpiresOn: '2026-11-10',
  status: 'active',
  homeDepot: { id: '0199d2a4-0000-7000-8000-000000000001', name: 'Brovary Logistics Park' },
}

// 10:00 in Kyiv on 27 October 2026
const now = () => new Date('2026-10-27T08:00:00Z')

const repositoryWith = (overrides: Partial<DriversRepository>) =>
  ({
    list: async () => ({ items: [], total: 0 }),
    findById: async () => undefined,
    ...overrides,
  }) as DriversRepository

describe('drivers service', () => {
  it('adds the state of the documents to every driver', async () => {
    const service = createDriversService({
      repository: repositoryWith({ list: async () => ({ items: [driver], total: 1 }) }),
      now,
    })

    const page = await service.list(DriverListQuerySchema.parse({}))

    expect(page.items[0]).toMatchObject({
      documentsExpireOn: '2026-11-10',
      documents: 'expiring',
    })
    expect(page).toMatchObject({ total: 1, page: 1, pageSize: 20 })
  })

  it('turns a documents filter into the matching range of expiry dates', async () => {
    const list = vi.fn<DriversRepository['list']>(async () => ({ items: [], total: 0 }))
    const service = createDriversService({ repository: repositoryWith({ list }), now })

    await service.list(DriverListQuerySchema.parse({ documents: 'expiring' }))
    await service.list(DriverListQuerySchema.parse({}))

    expect(list.mock.calls[0]?.[1]).toEqual({ from: '2026-10-27', to: '2026-11-26' })
    expect(list.mock.calls[1]?.[1]).toBeUndefined()
  })

  it('reports a missing driver as NotFoundError', async () => {
    const service = createDriversService({ repository: repositoryWith({}), now })

    await expect(service.get(DRIVER_ID)).rejects.toBeInstanceOf(NotFoundError)
  })
})
