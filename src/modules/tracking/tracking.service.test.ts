import { describe, expect, it, vi } from 'vitest'

import type { DemoRoute } from './domain/simulation.ts'
import {
  createTrackingService,
  type TrackedTrip,
  type TrackedVehicle,
  type TrackedWorkshopVisit,
} from './tracking.service.ts'

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

type ListTrips = (from: Date, to: Date) => Promise<TrackedTrip[]>
type ListWorkOrders = (from: Date, to: Date) => Promise<TrackedWorkshopVisit[]>

const serviceWith = ({
  listTrips = vi.fn<ListTrips>(async () => []),
  listWorkOrders = vi.fn<ListWorkOrders>(async () => []),
}: { listTrips?: ListTrips; listWorkOrders?: ListWorkOrders } = {}) =>
  createTrackingService({
    listVehicles: async () => [van, truckInService],
    listTrips,
    listWorkOrders,
    routes: [route],
    now: () => NOW,
  })

describe('tracking service', () => {
  it('places each vehicle along the trip it is on, and parks the rest', async () => {
    const listTrips = vi.fn<ListTrips>(async () => [vansTrip])

    const { at, vehicles } = await serviceWith({ listTrips }).positions()

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

  it('keeps a vehicle in the workshop at its depot while its work order is under way', async () => {
    const listWorkOrders = vi.fn<ListWorkOrders>(async () => [
      {
        vehicleId: van.id,
        startsAt: new Date(NOW - 60 * MINUTE),
        endsAt: new Date(NOW + 60 * MINUTE),
      },
    ])

    const [vanNow] = (
      await serviceWith({ listTrips: async () => [vansTrip], listWorkOrders }).positions()
    ).vehicles

    expect(vanNow).toMatchObject({ lng: 30, lat: 50, activity: 'in_workshop', routeId: null })
  })

  it('rounds positions to what a map needs', async () => {
    const [position] = (await serviceWith({ listTrips: async () => [vansTrip] }).positions())
      .vehicles

    expect(String(position?.lng).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(6)
    expect(Number.isInteger(position?.headingDeg ?? 0)).toBe(true)
  })

  it('lists the routes with how long a trip on each takes', () => {
    const [listed] = serviceWith().routes().routes

    expect(listed).toMatchObject(route)
    // About 14 km at 40 km/h is some 21 minutes each way, plus 20 at the customer
    expect(listed?.driveMs).toBeGreaterThan(20 * MINUTE)
    expect(listed?.roundTripMs).toBe(2 * (listed?.driveMs ?? 0) + 20 * MINUTE)
  })
})
