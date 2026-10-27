import { describe, expect, it, vi } from 'vitest'

import type { DemoRoute } from './domain/simulation.ts'
import { createTrackingService, type TrackedTrip, type TrackedVehicle } from './tracking.service.ts'

const MINUTE = 60_000
const NOW = Date.UTC(2026, 9, 27, 9)

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

// The van left ten minutes ago, so it is on its way out to the customer
const vansTrip: TrackedTrip = {
  vehicleId: van.id,
  routeId: route.id,
  departsAt: new Date(NOW - 10 * MINUTE),
  returnsAt: new Date(NOW + 50 * MINUTE),
}

const serviceWith = (listTrips = vi.fn<(from: Date, to: Date) => Promise<TrackedTrip[]>>()) =>
  createTrackingService({
    listVehicles: async () => [van, truckInService],
    listTrips,
    routes: [route],
    now: () => NOW,
  })

describe('tracking service', () => {
  it('places each vehicle along the trip it is on, and parks the rest', async () => {
    const listTrips = vi.fn<(from: Date, to: Date) => Promise<TrackedTrip[]>>(async () => [
      vansTrip,
    ])

    const { at, vehicles } = await serviceWith(listTrips).positions()

    expect(at).toBe(new Date(NOW).toISOString())
    expect(listTrips).toHaveBeenCalledWith(new Date(NOW - 60 * MINUTE), new Date(NOW + 60 * MINUTE))
    expect(vehicles[0]).toMatchObject({
      vehicleId: van.id,
      plate: 'AA 1234 KB',
      activity: 'to_customer',
      routeId: 'depot-customer',
    })
    expect(vehicles[1]).toMatchObject({ lng: 30, lat: 50, activity: 'off_duty', speedKmh: 0 })
  })

  it('rounds positions to what a map needs', async () => {
    const [position] = (
      await serviceWith(
        vi.fn<(from: Date, to: Date) => Promise<TrackedTrip[]>>(async () => [vansTrip]),
      ).positions()
    ).vehicles

    expect(String(position?.lng).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(6)
    expect(Number.isInteger(position?.headingDeg ?? 0)).toBe(true)
  })

  it('lists the routes without the prepared geometry', () => {
    expect(serviceWith().routes()).toEqual({ routes: [route] })
  })
})
