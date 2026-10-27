import { describe, expect, it, vi } from 'vitest'

import { NotFoundError } from '../../shared/errors.ts'
import { createTestServer } from '../../shared/http/test-server.ts'
import { driverRoutes } from './drivers.routes.ts'
import type { Driver } from './drivers.schemas.ts'
import type { DriversService } from './drivers.service.ts'

const DRIVER_ID = '0199d2a4-5f3e-7c11-9a2b-3c4d5e6f7a8b'

const driver: Driver = {
  id: DRIVER_ID,
  firstName: 'Olena',
  lastName: 'Kovalenko',
  phone: '+380671234567',
  licenseNumber: 'AKH123456',
  licenseCategories: ['B', 'C', 'CE'],
  licenseExpiresOn: '2029-03-01',
  medicalExpiresOn: '2026-11-10',
  documentsExpireOn: '2026-11-10',
  documents: 'expiring',
  status: 'active',
  homeDepot: { id: '0199d2a4-0000-7000-8000-000000000001', name: 'Brovary Logistics Park' },
}

async function serverWith(service: Partial<DriversService>) {
  const app = createTestServer()
  await app.register(driverRoutes, { prefix: '/api/v1', service: service as DriversService })
  return app
}

describe('driver routes', () => {
  it('lists drivers, filling in the default page and sort', async () => {
    const list = vi.fn<DriversService['list']>(async (query) => ({
      items: [driver],
      total: 1,
      page: query.page,
      pageSize: query.pageSize,
    }))
    const app = await serverWith({ list })

    const response = await app.inject({ method: 'GET', url: '/api/v1/drivers?documents=expiring' })

    expect(response.statusCode).toBe(200)
    expect(list).toHaveBeenCalledWith({
      documents: 'expiring',
      page: 1,
      pageSize: 20,
      sort: 'lastName',
    })
    expect(response.json()).toEqual({ items: [driver], total: 1, page: 1, pageSize: 20 })
  })

  it('rejects invalid filters before they reach the service', async () => {
    const list = vi.fn<DriversService['list']>()
    const app = await serverWith({ list })

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/drivers?documents=lost&status=fired&sort=age',
    })

    expect(response.statusCode).toBe(400)
    expect(Object.keys(response.json().errors).sort()).toEqual(['documents', 'sort', 'status'])
    expect(list).not.toHaveBeenCalled()
  })

  it('returns one driver by id', async () => {
    const app = await serverWith({ get: async () => driver })

    const response = await app.inject({ method: 'GET', url: `/api/v1/drivers/${DRIVER_ID}` })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(driver)
  })

  it('answers 404 Problem Details for an unknown driver', async () => {
    const app = await serverWith({
      get: async (id) => {
        throw new NotFoundError('Driver', id)
      },
    })

    const response = await app.inject({ method: 'GET', url: `/api/v1/drivers/${DRIVER_ID}` })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ code: 'NOT_FOUND' })
  })
})
