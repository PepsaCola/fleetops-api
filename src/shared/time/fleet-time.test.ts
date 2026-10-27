import { describe, expect, it } from 'vitest'

import { addDays, fleetInstant, fleetToday } from './fleet-time.ts'

describe('fleet time', () => {
  it('takes today from Kyiv time, not from the server clock', () => {
    // 22:30 UTC on 26 October is already 00:30 on the 27th in Kyiv (UTC+2 in winter)
    expect(fleetToday(new Date('2026-10-26T22:30:00Z'))).toBe('2026-10-27')
  })

  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('finds the moment Kyiv clocks show a time of day', () => {
    expect(fleetInstant('2026-01-15', 7 * 60).toISOString()).toBe('2026-01-15T05:00:00.000Z')
    // Half past midnight in Kyiv is still the evening before in UTC
    expect(fleetInstant('2026-01-15', 30).toISOString()).toBe('2026-01-14T22:30:00.000Z')
  })
})
