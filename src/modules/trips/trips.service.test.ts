import { describe, expect, it, vi } from 'vitest'

import { DEMO_ROUTES, prepareRoute } from '../tracking/index.ts'
import type { PlanningDriver, PlanningVehicle } from './domain/timetable.ts'
import type { TripRow, TripsRepository } from './trips.repository.ts'
import { TripListQuerySchema } from './trips.schemas.ts'
import { createTripsService, type WorkshopVisit } from './trips.service.ts'

const NOW = new Date('2026-10-27T10:00:00Z') // 12:00 in Kyiv
const HOUR = 60 * 60_000
const query = (input: Record<string, unknown> = {}) => TripListQuerySchema.parse(input)
const localRoute = DEMO_ROUTES.map(prepareRoute).find(
  (route) => route.kind === 'local' && route.id.startsWith('brovary'),
)!

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

/** A trip that left at 09:30 UTC, so it is on the road at NOW */
const row: TripRow = {
  id: '0199d2a4-5f3e-7c11-9a2b-3c4d5e6f7a8b',
  number: 1042,
  routeId: localRoute.id,
  departsAt: new Date('2026-10-27T09:30:00Z'),
  returnsAt: new Date('2026-10-27T11:30:00Z'),
  cancelledAt: null,
  vehicle: { id: van.id, plate: 'AA 1234 KB', type: 'van' },
  driver: { id: driver.id, firstName: 'Olena', lastName: 'Bondar' },
}

function fakeRepository(overrides: Partial<TripsRepository> = {}): TripsRepository {
  return {
    list: vi.fn<TripsRepository['list']>(async () => ({ items: [], total: 0 })),
    findById: vi.fn<TripsRepository['findById']>(async () => row),
    listOverlapping: vi.fn<TripsRepository['listOverlapping']>(async () => []),
    findClashes: vi.fn<TripsRepository['findClashes']>(async () => []),
    insert: vi.fn<TripsRepository['insert']>(async () => row.id),
    update: vi.fn<TripsRepository['update']>(async () => undefined),
    cancel: vi.fn<TripsRepository['cancel']>(async () => undefined),
    isPlanned: vi.fn<TripsRepository['isPlanned']>(async () => false),
    addPlannedDay: vi.fn<TripsRepository['addPlannedDay']>(async (_day, planned) => planned.length),
    ...overrides,
  }
}

const serviceWith = (repository: TripsRepository, workshop: WorkshopVisit[] = []) =>
  createTripsService({
    repository,
    listVehicles: async () => [van],
    listDrivers: async () => [driver],
    listWorkOrders: async () => workshop,
    now: () => NOW,
  })

const plannedDays = (repository: TripsRepository) =>
  vi.mocked(repository.addPlannedDay).mock.calls.map(([day]) => day)

const bookingAt = (departsAt: Date) => ({
  vehicleId: van.id,
  driverId: driver.id,
  routeId: localRoute.id,
  departsAt: departsAt.toISOString(),
})

describe('trips service', () => {
  it('plans a day, and the day before it, the first time anyone looks', async () => {
    const repository = fakeRepository()

    await serviceWith(repository).list(query({ day: '2026-10-27' }))

    expect(plannedDays(repository)).toEqual(['2026-10-26', '2026-10-27'])
    expect(vi.mocked(repository.addPlannedDay).mock.calls[1]?.[1].length).toBeGreaterThan(0)
  })

  it('leaves out the usual trips of a vehicle that is in the workshop then', async () => {
    const repository = fakeRepository()
    const allWeek: WorkshopVisit = {
      vehicleId: van.id,
      number: 5001,
      startsAt: new Date('2026-10-25T00:00:00Z'),
      endsAt: new Date('2026-10-30T00:00:00Z'),
    }

    await serviceWith(repository, [allWeek]).list(query({ day: '2026-10-27' }))

    const planned = vi.mocked(repository.addPlannedDay).mock.calls.map(([, trips]) => trips)
    expect(planned).toEqual([[], []])
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

    await serviceWith(repository).listOverlapping(
      new Date(NOW.getTime() - HOUR),
      new Date(NOW.getTime() + HOUR),
    )

    expect(plannedDays(repository).toSorted()).toEqual(['2026-10-26', '2026-10-27'])
    expect(repository.listOverlapping).toHaveBeenCalledOnce()
  })

  it('shows the status and the arrival at the customer from the clock and the route', async () => {
    const trip = await serviceWith(fakeRepository()).get(row.id)

    expect(trip).toMatchObject({
      number: 1042,
      status: 'in_progress',
      route: { id: localRoute.id, name: localRoute.name, kind: 'local' },
      departsAt: '2026-10-27T09:30:00.000Z',
    })
    expect(Date.parse(trip.arrivesAt) - Date.parse(trip.departsAt)).toBe(localRoute.driveMs)
  })

  it('books a trip that keeps the rules, back when its route says', async () => {
    const repository = fakeRepository()
    const departsAt = new Date(NOW.getTime() + 2 * HOUR)

    await serviceWith(repository).create(bookingAt(departsAt))

    expect(repository.insert).toHaveBeenCalledWith({
      vehicleId: van.id,
      driverId: driver.id,
      routeId: localRoute.id,
      departsAt,
      returnsAt: new Date(departsAt.getTime() + localRoute.roundTripMs),
    })
  })

  it('refuses a booking while the vehicle is in the workshop', async () => {
    const repository = fakeRepository()
    const service = serviceWith(repository, [
      {
        vehicleId: van.id,
        number: 5001,
        startsAt: new Date(NOW.getTime() + HOUR),
        endsAt: new Date(NOW.getTime() + 5 * HOUR),
      },
    ])

    await expect(
      service.create(bookingAt(new Date(NOW.getTime() + 2 * HOUR))),
    ).rejects.toMatchObject({
      status: 409,
      code: 'VEHICLE_IN_WORKSHOP',
      details: { workOrders: [5001] },
    })
    expect(repository.insert).not.toHaveBeenCalled()
  })

  it('refuses a booking that clashes with a trip already booked', async () => {
    const repository = fakeRepository({
      findClashes: vi.fn<TripsRepository['findClashes']>(async () => [
        { number: 1042, vehicleId: van.id, driverId: 'someone-else' },
      ]),
    })

    await expect(
      serviceWith(repository).create(bookingAt(new Date(NOW.getTime() + 2 * HOUR))),
    ).rejects.toMatchObject({ status: 409, code: 'TRIP_OVERLAP', details: { trips: [1042] } })
    expect(repository.insert).not.toHaveBeenCalled()
  })

  it('refuses a booking that breaks the rules, saying which one', async () => {
    const repository = fakeRepository()

    await expect(
      serviceWith(repository).create(bookingAt(new Date(NOW.getTime() - HOUR))),
    ).rejects.toMatchObject({ status: 422, code: 'DEPARTURE_IN_PAST' })
  })

  it('changes and cancels only trips that haven’t left yet', async () => {
    const repository = fakeRepository()
    const service = serviceWith(repository)

    await expect(
      service.update(row.id, { departsAt: new Date(NOW.getTime() + HOUR).toISOString() }),
    ).rejects.toMatchObject({ code: 'TRIP_NOT_EDITABLE' })
    await expect(service.cancel(row.id)).rejects.toMatchObject({ code: 'TRIP_NOT_EDITABLE' })
    expect(repository.update).not.toHaveBeenCalled()
    expect(repository.cancel).not.toHaveBeenCalled()
  })
})
