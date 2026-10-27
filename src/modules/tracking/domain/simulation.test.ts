import { distance } from '@turf/distance'
import { describe, expect, it } from 'vitest'

import { DEMO_DEPOTS } from '../../demo/index.ts'
import { DEMO_ROUTES } from './demo-routes.gen.ts'
import {
  positionOnRoute,
  prepareRoute,
  routeFor,
  SIMULATION_EPOCH,
  simulateVehicle,
  type SimulatedVehicle,
} from './simulation.ts'

const MINUTE = 60_000

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

const at = (msIntoCycle: number) => positionOnRoute(route, 0, SIMULATION_EPOCH + msIntoCycle)

const vehicle = (overrides: Partial<SimulatedVehicle> = {}): SimulatedVehicle => ({
  id: '0199d2a4-5f3e-7c11-9a2b-3c4d5e6f7a8b',
  type: 'van',
  status: 'active',
  homeDepot: { location: DEPOT },
  ...overrides,
})

describe('fleet simulation', () => {
  it('drives out from the depot, heading for the customer', () => {
    const start = at(0)
    const halfway = at(route.driveMs / 2)

    expect(start).toMatchObject({ lng: 30, lat: 50, activity: 'to_customer', speedKmh: 40 })
    expect(halfway.lng).toBeCloseTo(30.1, 2)
    expect(halfway.headingDeg).toBeCloseTo(90, 0)
  })

  it('stands at the customer, then drives back the other way', () => {
    const stopped = at(route.driveMs + 10 * MINUTE)
    const returning = at(route.driveMs + 20 * MINUTE + route.driveMs / 2)

    expect(stopped).toMatchObject({ activity: 'at_customer', speedKmh: 0, headingDeg: null })
    expect(stopped.lng).toBeCloseTo(30.2, 5)
    expect(returning.activity).toBe('to_depot')
    expect(returning.headingDeg).toBeCloseTo(270, 0)
  })

  it('moves smoothly and repeats every cycle', () => {
    const step = 10_000
    for (let t = 0; t < route.cycleMs; t += step) {
      const a = at(t)
      const b = at(t + step)
      // 10 seconds at 40 km/h is about 111 m
      expect(distance([a.lng, a.lat], [b.lng, b.lat])).toBeLessThan(0.12)
    }
    expect(at(route.cycleMs + 5 * MINUTE)).toEqual(at(5 * MINUTE))
  })

  it('sends vehicles out on routes of their kind from their own depot', () => {
    const routes = [
      route,
      prepareRoute({
        ...route,
        id: 'far-away',
        path: [
          [35, 48],
          [35.2, 48],
        ],
      }),
    ]

    expect(routeFor(vehicle(), routes)?.id).toBe('test-route')
    expect(routeFor(vehicle({ type: 'truck' }), routes)).toBeUndefined()
  })

  it('keeps vehicles that are not on duty parked at their depot', () => {
    const now = SIMULATION_EPOCH + 3 * MINUTE

    expect(simulateVehicle(vehicle({ status: 'maintenance' }), [route], now)).toMatchObject({
      ...DEPOT,
      activity: 'off_duty',
      speedKmh: 0,
    })
    expect(simulateVehicle(vehicle({ type: 'truck' }), [route], now)).toMatchObject({
      ...DEPOT,
      activity: 'at_depot',
    })
  })

  it('spreads vehicles that share a route along it', () => {
    const now = SIMULATION_EPOCH + 3 * MINUTE
    const a = simulateVehicle(vehicle({ id: 'vehicle-a' }), [route], now)
    const b = simulateVehicle(vehicle({ id: 'vehicle-b' }), [route], now)

    expect([a.lng, a.lat]).not.toEqual([b.lng, b.lat])
  })

  it('has local and regional routes from every demo depot', () => {
    const routes = DEMO_ROUTES.map(prepareRoute)

    for (const depot of DEMO_DEPOTS) {
      for (const type of ['van', 'truck'] as const) {
        const someVehicle = vehicle({ type, homeDepot: { location: depot.location } })
        expect(routeFor(someVehicle, routes), `${type} at ${depot.name}`).toBeDefined()
      }
    }
  })
})
