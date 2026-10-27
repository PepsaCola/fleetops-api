import { describe, expect, it } from 'vitest'

import {
  addDays,
  DOCUMENT_STATES,
  documentState,
  documentsExpireOn,
  expiryRange,
  fleetToday,
} from './documents.ts'

const TODAY = '2026-10-27'

describe('driver documents', () => {
  it('takes today from Kyiv time, not from the server clock', () => {
    // 22:30 UTC on 26 October is already 00:30 on the 27th in Kyiv (UTC+2 in winter)
    expect(fleetToday(new Date('2026-10-26T22:30:00Z'))).toBe('2026-10-27')
  })

  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('is decided by the document that expires first', () => {
    expect(
      documentsExpireOn({ licenseExpiresOn: '2027-05-01', medicalExpiresOn: '2026-11-15' }),
    ).toBe('2026-11-15')
  })

  it.each([
    ['2026-10-26', 'expired'],
    ['2026-10-27', 'expiring'], // still valid today, but only today
    ['2026-11-26', 'expiring'], // the 30th day
    ['2026-11-27', 'valid'],
  ] as const)('documents expiring on %s are %s', (expiresOn, state) => {
    expect(documentState(expiresOn, TODAY)).toBe(state)
  })

  it('filters by exactly the dates that give each state', () => {
    const days = Array.from({ length: 80 }, (_, index) => addDays(TODAY, index - 40))

    for (const state of DOCUMENT_STATES) {
      const { from = '0000-01-01', to = '9999-12-31' } = expiryRange(state, TODAY)
      const inRange = days.filter((day) => day >= from && day <= to)

      expect(inRange).toEqual(days.filter((day) => documentState(day, TODAY) === state))
    }
  })
})
