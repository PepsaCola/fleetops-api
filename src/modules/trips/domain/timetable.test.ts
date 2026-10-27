import { describe, expect, it } from 'vitest'

import { fleetInstant } from '../../../shared/time/fleet-time.ts'
import { DEMO_ROUTES, prepareRoute } from '../../tracking/index.ts'
import { planDay, type PlanningDriver, type PlanningVehicle } from './timetable.ts'

const DAY = '2026-11-02'
const MINUTE = 60_000
const routes = DEMO_ROUTES.map(prepareRoute)
const brovary = { id: 'depot-brovary', location: { lng: 30.79, lat: 50.511 } }

const vehicle = (
  type: PlanningVehicle['type'],
  overrides: Partial<PlanningVehicle> = {},
): PlanningVehicle => ({
  id: `vehicle-${type}`,
  type,
  status: 'active',
  homeDepot: brovary,
  ...overrides,
})

const driver = (
  licenseCategories: string[],
  overrides: Partial<PlanningDriver> = {},
): PlanningDriver => ({
  id: `driver-${licenseCategories.join('')}`,
  status: 'active',
  homeDepotId: brovary.id,
  licenseCategories,
  licenseExpiresOn: '2030-01-01',
  medicalExpiresOn: '2030-01-01',
  ...overrides,
})

const kindsOf = (trips: ReturnType<typeof planDay>) =>
  new Set(trips.map((trip) => routes.find((route) => route.id === trip.routeId)?.kind))
const driversOf = (trips: ReturnType<typeof planDay>) => new Set(trips.map((trip) => trip.driverId))

describe('planDay', () => {
  it('fills a van driver’s day shift with local trips and breaks at the depot', () => {
    const trips = planDay(DAY, { vehicles: [vehicle('van')], drivers: [driver(['B'])], routes })

    expect(trips.length).toBeGreaterThanOrEqual(2)
    expect(kindsOf(trips)).toEqual(new Set(['local']))

    const starts = trips[0]?.departsAt.getTime() ?? 0
    expect(starts).toBeGreaterThanOrEqual(fleetInstant(DAY, 6 * 60).getTime())
    expect(starts).toBeLessThanOrEqual(fleetInstant(DAY, 14 * 60).getTime())
    expect((trips.at(-1)?.returnsAt.getTime() ?? 0) - starts).toBeLessThanOrEqual(10 * 60 * MINUTE)

    const breaks = trips
      .slice(1)
      .map((trip, index) => trip.departsAt.getTime() - (trips[index]?.returnsAt.getTime() ?? 0))
    expect(new Set(breaks)).toEqual(new Set([40 * MINUTE]))
  })

  it('sends a truck on regional runs, only with a driver who holds category C', () => {
    const truck = vehicle('truck')
    expect(planDay(DAY, { vehicles: [truck], drivers: [driver(['B', 'C1'])], routes })).toEqual([])

    const trips = planDay(DAY, {
      vehicles: [truck],
      drivers: [driver(['B', 'C1']), driver(['B', 'C', 'CE'])],
      routes,
    })
    expect(trips.length).toBeGreaterThan(0)
    expect(driversOf(trips)).toEqual(new Set(['driver-BCCE']))
    expect(kindsOf(trips)).toEqual(new Set(['regional']))
  })

  it('takes a driver from the vehicle’s own depot first, and borrows one only when it has none', () => {
    const fromBoryspil = driver(['B'], { id: 'driver-boryspil', homeDepotId: 'depot-boryspil' })
    const fromBrovary = driver(['B'], { id: 'driver-brovary' })
    const van = vehicle('van')

    expect(
      driversOf(planDay(DAY, { vehicles: [van], drivers: [fromBoryspil, fromBrovary], routes })),
    ).toEqual(new Set(['driver-brovary']))
    expect(driversOf(planDay(DAY, { vehicles: [van], drivers: [fromBoryspil], routes }))).toEqual(
      new Set(['driver-boryspil']),
    )
  })

  it('leaves out vehicles off the road and drivers who can’t work that day', () => {
    const plan = (vehicles: PlanningVehicle[], drivers: PlanningDriver[]) =>
      planDay(DAY, { vehicles, drivers, routes })
    const van = vehicle('van')

    expect(plan([vehicle('van', { status: 'maintenance' })], [driver(['B'])])).toEqual([])
    expect(plan([van], [driver(['B'], { status: 'on_leave' })])).toEqual([])
    expect(plan([van], [driver(['B'], { medicalExpiresOn: '2026-11-01' })])).toEqual([])
  })
})
