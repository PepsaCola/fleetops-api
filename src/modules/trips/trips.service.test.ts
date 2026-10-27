import { describe, expect, it, vi } from 'vitest'

import { DEMO_ROUTES, prepareRoute } from '../tracking/index.ts'
import type { PlanningDriver, PlanningVehicle } from './domain/timetable.ts'
import type { TripRow, TripsRepository } from './trips.repository.ts'
import { TripListQuerySchema } from './trips.schemas.ts'
import { createTripsService } from './trips.service.ts'

const NOW = new Date('2026-10-27T10:00:00Z') // 12:00 in Kyiv
const query = (input: Record<string, unknown> = {}) => TripListQuerySchema.parse(input)

const van: PlanningVehicle = {
  id: 'vehicle-1',
  type: 'van',
  status: 'active',
  homeDepot: { id: 'depot-1', location: { lng: 30.79, lat: 50.511 } },
}
const driver: PlanningDriver = {
  id: 'driver-1',
  status: 'active',
  homeDepotId: 'depot-1',
  licenseCategories: ['B'],
  licenseExpiresOn: '2030-01-01',
  medicalExpiresOn: '2030-01-01',
}

function fakeRepository(overrides: Partial<TripsRepository> = {}): TripsRepository {
  return {
    list: vi.fn<TripsRepository['list']>(async () => ({ items: [], total: 0 })),
    findById: vi.fn<TripsRepository['findById']>(),
    listOverlapping: vi.fn<TripsRepository['listOverlapping']>(async () => []),
    isPlanned: vi.fn<TripsRepository['isPlanned']>(async () => false),
    addPlannedDay: vi.fn<TripsRepository['addPlannedDay']>(async (_day, planned) => planned.length),
    ...overrides,
  }
}

const serviceWith = (repository: TripsRepository) =>
  createTripsService({
    repository,
    listVehicles: async () => [van],
    listDrivers: async () => [driver],
    now: () => NOW,
  })

const plannedDays = (repository: TripsRepository) =>
  vi.mocked(repository.addPlannedDay).mock.calls.map(([day]) => day)

describe('trips service', () => {
  it('plans a day, and the day before it, the first time anyone looks', async () => {
    const repository = fakeRepository()

    await serviceWith(repository).list(query({ day: '2026-10-27' }))

    expect(plannedDays(repository)).toEqual(['2026-10-26', '2026-10-27'])
    expect(vi.mocked(repository.addPlannedDay).mock.calls[1]?.[1].length).toBeGreaterThan(0)
  })

  it('leaves planned days and days far from today alone', async () => {
    const repository = fakeRepository({
      isPlanned: vi.fn<TripsRepository['isPlanned']>(async () => true),
    })
    const service = serviceWith(repository)

    await service.list(query({ day: '2026-10-27' }))
    await service.list(query({ day: '2027-06-01' }))

    expect(vi.mocked(repository.isPlanned).mock.calls.map(([day]) => day)).toEqual([
      '2026-10-26',
      '2026-10-27',
    ])
    expect(repository.addPlannedDay).not.toHaveBeenCalled()
  })

  it('plans the days around a moment before saying who is on the road then', async () => {
    const repository = fakeRepository()
    const hour = 60 * 60_000

    await serviceWith(repository).listOverlapping(
      new Date(NOW.getTime() - hour),
      new Date(NOW.getTime() + hour),
    )

    expect(plannedDays(repository).toSorted()).toEqual(['2026-10-26', '2026-10-27'])
    expect(repository.listOverlapping).toHaveBeenCalledOnce()
  })

  it('shows the status and the arrival at the customer from the clock and the route', async () => {
    const route = DEMO_ROUTES[0]!
    const row: TripRow = {
      id: '0199d2a4-5f3e-7c11-9a2b-3c4d5e6f7a8b',
      number: 1042,
      routeId: route.id,
      departsAt: new Date('2026-10-27T09:30:00Z'),
      returnsAt: new Date('2026-10-27T11:30:00Z'),
      cancelledAt: null,
      vehicle: { id: '0199d2a4-0000-7000-8000-000000000001', plate: 'AA 1234 KB', type: 'van' },
      driver: {
        id: '0199d2a4-0000-7000-8000-000000000002',
        firstName: 'Olena',
        lastName: 'Bondar',
      },
    }
    const service = serviceWith(
      fakeRepository({ findById: vi.fn<TripsRepository['findById']>(async () => row) }),
    )

    const trip = await service.get(row.id)

    expect(trip).toMatchObject({
      number: 1042,
      status: 'in_progress',
      route: { id: route.id, name: route.name, kind: route.kind },
      departsAt: '2026-10-27T09:30:00.000Z',
    })
    expect(Date.parse(trip.arrivesAt) - Date.parse(trip.departsAt)).toBe(
      prepareRoute(route).driveMs,
    )
  })
})
