import { describe, expect, it, vi } from 'vitest'

import { createCostsService } from './costs.service.ts'
import { DIESEL_UAH_PER_LITRE } from './domain/fuel.ts'
import type { CostTrip } from './domain/report.ts'

const NOW = new Date('2026-10-28T10:00:00Z')

const serviceWith = (
  listTrips = vi.fn<(first: string, last: string) => Promise<CostTrip[]>>(async () => []),
) =>
  createCostsService({
    listVehicles: async () => [],
    listTrips,
    listWorkOrders: async () => [],
    now: () => NOW,
  })

describe('costs service', () => {
  it('reports every day of the period, asking for that period’s trips', async () => {
    const listTrips = vi.fn<(first: string, last: string) => Promise<CostTrip[]>>(async () => [])

    const report = await serviceWith(listTrips).report({ from: '2026-10-26', to: '2026-10-28' })

    expect(listTrips).toHaveBeenCalledWith('2026-10-26', '2026-10-28')
    expect(report.days.map(({ day }) => day)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28'])
    expect(report.dieselUahPerLitre).toBe(DIESEL_UAH_PER_LITRE)
  })

  it('refuses a period that runs backwards or longer than 62 days', async () => {
    const service = serviceWith()

    await expect(service.report({ from: '2026-10-28', to: '2026-10-27' })).rejects.toMatchObject({
      status: 422,
      code: 'RANGE_TOO_LONG',
    })
    await expect(service.report({ from: '2026-08-01', to: '2026-10-28' })).rejects.toMatchObject({
      code: 'RANGE_TOO_LONG',
    })
  })
})
