import { describe, expect, it } from 'vitest'

import { SIMULATION_EPOCH, type DemoRoute } from './domain/simulation.ts'
import { createTrackingService, type TrackedVehicle } from './tracking.service.ts'

const route: DemoRoute = {
  id: 'depot-customer',
  name: 'Depot → Customer',
  kind: 'local',
  path: [
    [30, 50],
    [30.2, 50],
  ],
}

const depot = { location: { lng: 30, lat: 50 } }

const van: TrackedVehicle = {
  id: '0199d2a4-5f3e-7c11-9a2b-3c4d5e6f7a8b',
  plate: 'AA 1234 KB',
  type: 'van',
  status: 'active',
  homeDepot: depot,
}
const truckInService: TrackedVehicle = {
  ...van,
  id: '0199d2a4-5f3e-7c11-9a2b-000000000002',
  plate: 'AI 5678 KA',
  type: 'truck',
  status: 'maintenance',
}

const now = SIMULATION_EPOCH + 60 * 60_000

describe('tracking service', () => {
  it('places every vehicle at the position the simulation gives for now', async () => {
    const service = createTrackingService({
      listVehicles: async () => [van, truckInService],
      routes: [route],
      now: () => now,
    })

    const { at, vehicles } = await service.positions()

    expect(at).toBe(new Date(now).toISOString())
    expect(vehicles).toHaveLength(2)
    expect(vehicles[0]).toMatchObject({ vehicleId: van.id, plate: 'AA 1234 KB', type: 'van' })
    expect(vehicles[0]?.routeId).toBe('depot-customer')
    expect(vehicles[1]).toMatchObject({ lng: 30, lat: 50, activity: 'off_duty', speedKmh: 0 })
  })

  it('rounds positions to what a map needs', async () => {
    const service = createTrackingService({
      listVehicles: async () => [van],
      routes: [route],
      now: () => now,
    })

    const [position] = (await service.positions()).vehicles

    expect(String(position?.lng).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(6)
    expect(Number.isInteger(position?.headingDeg ?? 0)).toBe(true)
  })

  it('lists the routes without the prepared geometry', () => {
    const service = createTrackingService({ listVehicles: async () => [], routes: [route] })

    expect(service.routes()).toEqual({ routes: [route] })
  })
})
