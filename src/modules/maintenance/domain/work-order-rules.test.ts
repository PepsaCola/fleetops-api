import { describe, expect, it } from 'vitest'

import { workOrderProblem, type WorkshopBooking } from './work-order-rules.ts'

const HOUR = 60 * 60_000
const NOW = new Date('2026-10-28T10:00:00Z')

const booking = (overrides: Partial<WorkshopBooking> = {}): WorkshopBooking => ({
  vehicle: { status: 'active' },
  startsAt: new Date(NOW.getTime() + 24 * HOUR),
  endsAt: new Date(NOW.getTime() + 28 * HOUR),
  ...overrides,
})

describe('workOrderProblem', () => {
  it('accepts a work order that keeps every rule, also for a vehicle already in maintenance', () => {
    expect(workOrderProblem(booking(), NOW)).toBeNull()
    expect(workOrderProblem(booking({ vehicle: { status: 'maintenance' } }), NOW)).toBeNull()
  })

  it.each([
    ['ENDS_BEFORE_START', { endsAt: new Date(NOW.getTime() + 20 * HOUR) }],
    ['START_IN_PAST', { startsAt: new Date(NOW.getTime() - HOUR) }],
    ['WORK_ORDER_TOO_LONG', { endsAt: new Date(NOW.getTime() + 9 * 24 * HOUR) }],
    ['VEHICLE_RETIRED', { vehicle: { status: 'inactive' } }],
  ] as const)('refuses with %s', (code, overrides) => {
    expect(workOrderProblem(booking(overrides), NOW)?.code).toBe(code)
  })
})
