import { describe, expect, it, vi } from 'vitest'

import type { WorkOrderRow, WorkOrdersRepository } from './work-orders.repository.ts'
import { createWorkOrdersService, type VehicleTrip } from './work-orders.service.ts'

const NOW = new Date('2026-10-28T10:00:00Z')
const van = {
  id: '0199d2a4-0000-7000-8000-000000000001',
  type: 'van' as const,
  status: 'active' as const,
}

const row: WorkOrderRow = {
  id: '0199d2a4-5f3e-7c11-9a2b-3c4d5e6f7a8b',
  number: 5001,
  kind: 'service',
  startsAt: new Date('2026-10-29T06:00:00Z'),
  endsAt: new Date('2026-10-29T10:00:00Z'),
  costUah: 4800,
  note: '',
  cancelledAt: null,
  vehicle: { id: van.id, plate: 'AA 1234 KB', type: 'van' },
}

const booking = {
  vehicleId: van.id,
  kind: 'service' as const,
  startsAt: '2026-10-29T06:00:00.000Z',
  endsAt: '2026-10-29T10:00:00.000Z',
  costUah: 4800,
}

function fakeRepository(overrides: Partial<WorkOrdersRepository> = {}): WorkOrdersRepository {
  return {
    list: vi.fn<WorkOrdersRepository['list']>(async () => []),
    findById: vi.fn<WorkOrdersRepository['findById']>(async () => row),
    listBetween: vi.fn<WorkOrdersRepository['listBetween']>(async () => []),
    listOverlapping: vi.fn<WorkOrdersRepository['listOverlapping']>(async () => []),
    insert: vi.fn<WorkOrdersRepository['insert']>(async () => row.id),
    update: vi.fn<WorkOrdersRepository['update']>(async () => undefined),
    cancel: vi.fn<WorkOrdersRepository['cancel']>(async () => undefined),
    plannedDays: vi.fn<WorkOrdersRepository['plannedDays']>(async () => new Set<string>()),
    addPlannedDay: vi.fn<WorkOrdersRepository['addPlannedDay']>(
      async (_day, orders) => orders.length,
    ),
    ...overrides,
  }
}

const serviceWith = (repository: WorkOrdersRepository, trips: VehicleTrip[] = []) =>
  createWorkOrdersService({
    repository,
    listVehicles: async () => [van],
    listTrips: async () => trips,
    now: () => NOW,
  })

describe('work orders service', () => {
  it('books a vehicle into the workshop when it is free then', async () => {
    const repository = fakeRepository()

    const order = await serviceWith(repository).create(booking)

    expect(repository.insert).toHaveBeenCalledWith({
      vehicleId: van.id,
      kind: 'service',
      startsAt: new Date(booking.startsAt),
      endsAt: new Date(booking.endsAt),
      costUah: 4800,
      note: '',
    })
    expect(order).toMatchObject({ number: 5001, status: 'scheduled' })
  })

  it('refuses while the vehicle is on a trip then', async () => {
    const repository = fakeRepository()
    const trip: VehicleTrip = {
      vehicleId: van.id,
      number: 1042,
      departsAt: new Date('2026-10-29T08:00:00Z'),
      returnsAt: new Date('2026-10-29T11:00:00Z'),
    }

    await expect(serviceWith(repository, [trip]).create(booking)).rejects.toMatchObject({
      status: 409,
      code: 'TRIP_OVERLAP',
      details: { trips: [1042] },
    })
    expect(repository.insert).not.toHaveBeenCalled()
  })

  it('lists at most two months of days at once', async () => {
    const repository = fakeRepository()

    await expect(
      serviceWith(repository).list({ from: '2026-10-01', to: '2026-12-31' }),
    ).rejects.toMatchObject({ status: 422, code: 'RANGE_TOO_LONG' })
    expect(repository.list).not.toHaveBeenCalled()
  })

  it('books each day’s routine services once, before anyone looks at the day', async () => {
    const repository = fakeRepository({
      plannedDays: vi.fn<WorkOrdersRepository['plannedDays']>(async () => new Set(['2026-10-28'])),
    })

    await serviceWith(repository).list({ from: '2026-10-28', to: '2026-10-30' })

    expect(vi.mocked(repository.addPlannedDay).mock.calls.map(([day]) => day)).toEqual([
      '2026-10-29',
      '2026-10-30',
    ])
  })
})
