import { describe, expect, it, vi } from 'vitest'

import { NotFoundError } from '../../shared/errors.ts'
import { createTestServer } from '../../shared/http/test-server.ts'
import { vehicleRoutes } from './vehicles.routes.ts'
import type { Vehicle } from './vehicles.schemas.ts'
import type { VehiclesService } from './vehicles.service.ts'

const VEHICLE_ID = '0199d2a4-5f3e-7c11-9a2b-3c4d5e6f7a8b'

const vehicle: Vehicle = {
  id: VEHICLE_ID,
  plate: 'AA 1234 KB',
  make: 'Volvo',
  model: 'FH 500',
  year: 2021,
  type: 'truck',
  status: 'active',
  capacityKg: 22_000,
  fuelTankL: 750,
  odometerKm: 412_000,
  homeDepot: { id: '0199d2a4-0000-7000-8000-000000000001', name: 'Brovary Logistics Park' },
}

async function serverWith(service: Partial<VehiclesService>) {
  const app = createTestServer()
  await app.register(vehicleRoutes, { prefix: '/api/v1', service: service as VehiclesService })
  return app
}

describe('vehicle routes', () => {
  it('lists vehicles, filling in the default page and sort', async () => {
    const list = vi.fn<VehiclesService['list']>(async (query) => ({
      items: [vehicle],
      total: 1,
      page: query.page,
      pageSize: query.pageSize,
    }))
    const app = await serverWith({ list })

    const response = await app.inject({ method: 'GET', url: '/api/v1/vehicles?type=truck' })

    expect(response.statusCode).toBe(200)
    expect(list).toHaveBeenCalledWith({ type: 'truck', page: 1, pageSize: 20, sort: 'plate' })
    expect(response.json()).toEqual({ items: [vehicle], total: 1, page: 1, pageSize: 20 })
  })

  it('rejects invalid filters before they reach the service', async () => {
    const list = vi.fn<VehiclesService['list']>()
    const app = await serverWith({ list })

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/vehicles?pageSize=500&status=flying&sort=colour',
    })

    expect(response.statusCode).toBe(400)
    expect(Object.keys(response.json().errors).sort()).toEqual(['pageSize', 'sort', 'status'])
    expect(list).not.toHaveBeenCalled()
  })

  it('returns one vehicle by id', async () => {
    const app = await serverWith({ get: async () => vehicle })

    const response = await app.inject({ method: 'GET', url: `/api/v1/vehicles/${VEHICLE_ID}` })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(vehicle)
  })

  it('answers 404 Problem Details for an unknown vehicle', async () => {
    const app = await serverWith({
      get: async (id) => {
        throw new NotFoundError('Vehicle', id)
      },
    })

    const response = await app.inject({ method: 'GET', url: `/api/v1/vehicles/${VEHICLE_ID}` })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ code: 'NOT_FOUND' })
  })

  it('rejects an id that is not a UUID', async () => {
    const app = await serverWith({ get: vi.fn<VehiclesService['get']>() })

    const response = await app.inject({ method: 'GET', url: '/api/v1/vehicles/42' })

    expect(response.statusCode).toBe(400)
  })

  it('never sends fields that are not in the response schema', async () => {
    const leaky = { ...vehicle, internalNotes: 'engine replaced under warranty claim #5521' }
    const app = await serverWith({ get: async () => leaky })

    const response = await app.inject({ method: 'GET', url: `/api/v1/vehicles/${VEHICLE_ID}` })

    expect(response.json()).not.toHaveProperty('internalNotes')
  })
})
