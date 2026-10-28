import { describe, expect, it } from 'vitest'

import { DEMO_ROUTES, prepareRoute } from '../../tracking/index.ts'
import { bookingProblem, type TripBooking } from './booking.ts'
import type { PlanningDriver, PlanningVehicle } from './timetable.ts'

const MINUTE = 60_000
const NOW = new Date('2026-11-02T08:00:00Z')
const routes = DEMO_ROUTES.map(prepareRoute)
const fromBrovary = (kind: 'local' | 'regional') =>
  routes.find((route) => route.kind === kind && route.id.startsWith('brovary'))!

const van: PlanningVehicle = {
  id: 'vehicle-1',
  type: 'van',
  status: 'active',
  homeDepot: { id: 'depot-brovary', location: { lng: 30.79, lat: 50.511 } },
}
const driver: PlanningDriver = {
  id: 'driver-1',
  status: 'active',
  homeDepotId: 'depot-brovary',
  licenseCategories: ['B'],
  licenseExpiresOn: '2030-01-01',
  medicalExpiresOn: '2030-01-01',
}

const booking = (overrides: Partial<TripBooking> = {}): TripBooking => ({
  vehicle: van,
  driver,
  route: fromBrovary('local'),
  departsAt: new Date(NOW.getTime() + 60 * MINUTE),
  returnsAt: new Date(NOW.getTime() + 180 * MINUTE),
  ...overrides,
})

describe('bookingProblem', () => {
  it('accepts a booking that keeps every rule', () => {
    expect(bookingProblem(booking(), routes, NOW)).toBeNull()
  })

  it.each([
    ['DEPARTURE_IN_PAST', { departsAt: new Date(NOW.getTime() - MINUTE) }],
    ['VEHICLE_UNAVAILABLE', { vehicle: { ...van, status: 'maintenance' } }],
    ['ROUTE_NOT_ALLOWED', { route: fromBrovary('regional') }],
    ['DRIVER_UNAVAILABLE', { driver: { ...driver, status: 'on_leave' } }],
    [
      'LICENSE_CATEGORY_MISSING',
      { vehicle: { ...van, type: 'truck' }, route: fromBrovary('regional') },
    ],
    ['DRIVER_DOCUMENTS_EXPIRED', { driver: { ...driver, medicalExpiresOn: '2026-11-01' } }],
  ] as const)('refuses with %s', (code, overrides) => {
    expect(bookingProblem(booking(overrides), routes, NOW)?.code).toBe(code)
  })
})
