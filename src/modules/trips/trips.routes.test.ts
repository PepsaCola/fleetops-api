import { describe, expect, it, vi } from 'vitest'

import { createTestServer } from '../../shared/http/test-server.ts'
import { tripRoutes } from './trips.routes.ts'
import type { Trip } from './trips.schemas.ts'
import type { TripsService } from './trips.service.ts'

const TRIP_ID = '0199d2a4-5f3e-7c11-9a2b-3c4d5e6f7a8b'

const trip: Trip = {
  id: TRIP_ID,
  number: 1042,
  status: 'in_progress',
  vehicle: { id: '0199d2a4-0000-7000-8000-000000000001', plate: 'AA 1234 KB', type: 'van' },
  driver: { id: '0199d2a4-0000-7000-8000-000000000002', firstName: 'Olena', lastName: 'Bondar' },
  route: {
    id: 'brovary-logistics-park-kyiv-livoberezhna',
    name: 'Brovary Logistics Park → Kyiv, Livoberezhna',
    kind: 'local',
  },
  departsAt: '2026-10-27T08:00:00.000Z',
  arrivesAt: '2026-10-27T08:40:00.000Z',
  returnsAt: '2026-10-27T09:40:00.000Z',
  cancelledAt: null,
}

async function serverWith(service: Partial<TripsService>) {
  const app = createTestServer()
  await app.register(tripRoutes, { prefix: '/api/v1', service: service as TripsService })
  return app
}

describe('trip routes', () => {
  it('lists the trips of a day, filling in the default page and sort', async () => {
    const list = vi.fn<TripsService['list']>(async (query) => ({
      items: [trip],
      total: 1,
      page: query.page,
      pageSize: query.pageSize,
    }))
    const app = await serverWith({ list })

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/trips?day=2026-10-27&status=in_progress',
    })

    expect(response.statusCode).toBe(200)
    expect(list).toHaveBeenCalledWith({
      day: '2026-10-27',
      status: 'in_progress',
      page: 1,
      pageSize: 20,
      sort: 'departsAt',
    })
    expect(response.json()).toEqual({ items: [trip], total: 1, page: 1, pageSize: 20 })
  })

  it('rejects an invalid day or status before it reaches the service', async () => {
    const list = vi.fn<TripsService['list']>()
    const app = await serverWith({ list })

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/trips?day=27.10.2026&status=late',
    })

    expect(response.statusCode).toBe(400)
    expect(Object.keys(response.json().errors).sort()).toEqual(['day', 'status'])
    expect(list).not.toHaveBeenCalled()
  })

  it('returns one trip by id', async () => {
    const app = await serverWith({ get: async () => trip })

    const response = await app.inject({ method: 'GET', url: `/api/v1/trips/${TRIP_ID}` })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(trip)
  })
})
