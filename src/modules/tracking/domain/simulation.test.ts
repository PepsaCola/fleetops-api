import { distance } from '@turf/distance'
import { describe, expect, it } from 'vitest'

import { DEMO_DEPOTS } from '../../demo/index.ts'
import { DEMO_ROUTES } from './demo-routes.gen.ts'
import {
  positionOnTrip,
  prepareRoute,
  routesFrom,
  simulateVehicle,
  type SimulatedTrip,
  type SimulatedVehicle,
} from './simulation.ts'

const MINUTE = 60_000
const NOW = Date.UTC(2026, 9, 27, 9)

// About 14 km due east of the depot: 21 minutes each way at the local speed of 40 km/h
const DEPOT = { lng: 30, lat: 50 }
const route = prepareRoute({
  id: 'test-route',
  name: 'Depot → Customer',
  kind: 'local',
  path: [
    [30, 50],
    [30.2, 50],
  ],
})
const routes = new Map([[route.id, route]])

const vehicle = (overrides: Partial<SimulatedVehicle> = {}): SimulatedVehicle => ({
  id: '0199d2a4-5f3e-7c11-9a2b-3c4d5e6f7a8b',
  type: 'van',
  status: 'active',
  homeDepot: { location: DEPOT },
  ...overrides,
})

const tripLeaving = (departsAt: number): SimulatedTrip => ({
  routeId: route.id,
  departsAt: new Date(departsAt),
  returnsAt: new Date(departsAt + route.roundTripMs),
})

describe('positions on a trip', () => {
  it('drives out from the depot, heading for the customer', () => {
    const start = positionOnTrip(route, 0)
    const halfway = positionOnTrip(route, route.driveMs / 2)

    expect(start).toMatchObject({ lng: 30, lat: 50, activity: 'to_customer', speedKmh: 40 })
    expect(halfway.lng).toBeCloseTo(30.1, 2)
    expect(halfway.headingDeg).toBeCloseTo(90, 0)
  })

  it('stands at the customer, then drives back the other way', () => {
    const stopped = positionOnTrip(route, route.driveMs + 10 * MINUTE)
    const returning = positionOnTrip(route, route.driveMs + 20 * MINUTE + route.driveMs / 2)

    expect(stopped).toMatchObject({ activity: 'at_customer', speedKmh: 0, headingDeg: null })
    expect(stopped.lng).toBeCloseTo(30.2, 5)
    expect(returning.activity).toBe('to_depot')
    expect(returning.headingDeg).toBeCloseTo(270, 0)
  })

  it('moves smoothly from leaving the depot to being back', () => {
    const step = 10_000
    for (let t = 0; t < route.roundTripMs; t += step) {
      const a = positionOnTrip(route, t)
      const b = positionOnTrip(route, t + step)
      // 10 seconds at 40 km/h is about 111 m
      expect(distance([a.lng, a.lat], [b.lng, b.lat])).toBeLessThan(0.12)
    }
    expect(positionOnTrip(route, route.roundTripMs - 1).lng).toBeCloseTo(30, 3)
  })
})

describe('vehicle positions', () => {
  it('follows the trip the vehicle is on', () => {
    const position = simulateVehicle(vehicle(), [tripLeaving(NOW - 10 * MINUTE)], routes, NOW)

    expect(position).toMatchObject({ activity: 'to_customer', routeId: 'test-route' })
  })

  it('waits at the depot around its trips and is off duty away from them', () => {
    const at = (trip: SimulatedTrip) => simulateVehicle(vehicle(), [trip], routes, NOW).activity

    expect(at(tripLeaving(NOW + 30 * MINUTE))).toBe('at_depot')
    expect(at(tripLeaving(NOW - route.roundTripMs - 30 * MINUTE))).toBe('at_depot')
    expect(at(tripLeaving(NOW + 3 * 60 * MINUTE))).toBe('off_duty')
    expect(simulateVehicle(vehicle(), [], routes, NOW)).toMatchObject({
      ...DEPOT,
      activity: 'off_duty',
    })
  })

  it('keeps vehicles that are not in service parked, whatever their trips say', () => {
    const position = simulateVehicle(
      vehicle({ status: 'maintenance' }),
      [tripLeaving(NOW - 10 * MINUTE)],
      routes,
      NOW,
    )

    expect(position).toMatchObject({ ...DEPOT, activity: 'off_duty', speedKmh: 0 })
  })
})

describe('routes', () => {
  it('offers vehicles the routes of their kind from their own depot', () => {
    const farAway = prepareRoute({
      ...route,
      id: 'far-away',
      path: [
        [35, 48],
        [35.2, 48],
      ],
    })

    expect(routesFrom(vehicle(), [route, farAway]).map(({ id }) => id)).toEqual(['test-route'])
    expect(routesFrom(vehicle({ type: 'truck' }), [route, farAway])).toEqual([])
  })

  it('has local and regional routes from every demo depot', () => {
    const demoRoutes = DEMO_ROUTES.map(prepareRoute)

    for (const depot of DEMO_DEPOTS) {
      for (const type of ['van', 'truck'] as const) {
        const someVehicle = vehicle({ type, homeDepot: { location: depot.location } })
        expect(routesFrom(someVehicle, demoRoutes), `${type} at ${depot.name}`).not.toEqual([])
      }
    }
  })
})
