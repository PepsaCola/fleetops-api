import { describe, expect, it } from 'vitest'

import { createTestServer } from '../../shared/http/test-server.ts'
import type { FleetPositions, TrackingRoutes } from './tracking.schemas.ts'
import { trackingRoutes } from './tracking.routes.ts'
import type { TrackingService } from './tracking.service.ts'

const positions: FleetPositions = {
  at: '2026-10-27T15:00:00.000Z',
  vehicles: [
    {
      vehicleId: '0199d2a4-5f3e-7c11-9a2b-3c4d5e6f7a8b',
      plate: 'AA 1234 KB',
      type: 'van',
      lng: 30.512345,
      lat: 50.45,
      headingDeg: 87,
      speedKmh: 40,
      activity: 'to_customer',
      routeId: 'depot-customer',
    },
  ],
}

const routes: TrackingRoutes = {
  routes: [
    {
      id: 'depot-customer',
      name: 'Depot → Customer',
      kind: 'local',
      path: [
        [30, 50],
        [30.2, 50],
      ],
    },
  ],
}

async function serverWith(service: Partial<TrackingService>) {
  const app = createTestServer()
  await app.register(trackingRoutes, { prefix: '/api/v1', service: service as TrackingService })
  return app
}

describe('tracking routes', () => {
  it('answers with the current positions, never cached', async () => {
    const app = await serverWith({ positions: async () => positions })

    const response = await app.inject({ method: 'GET', url: '/api/v1/tracking/positions' })

    expect(response.statusCode).toBe(200)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.json()).toEqual(positions)
  })

  it('answers with the routes, cacheable for an hour', async () => {
    const app = await serverWith({ routes: () => routes })

    const response = await app.inject({ method: 'GET', url: '/api/v1/tracking/routes' })

    expect(response.statusCode).toBe(200)
    expect(response.headers['cache-control']).toBe('public, max-age=3600')
    expect(response.json()).toEqual(routes)
  })
})
