import { describe, expect, it } from 'vitest'

import { addDays, fleetInstant } from '../../../shared/time/fleet-time.ts'
import { planServices, SERVICE_EVERY_DAYS, type ServicedVehicle } from './routine-services.ts'

const vehicle = (n: number, overrides: Partial<ServicedVehicle> = {}): ServicedVehicle => ({
  id: `vehicle-${n}`,
  type: 'van',
  status: 'active',
  ...overrides,
})

const fortnight = Array.from({ length: SERVICE_EVERY_DAYS }, (_, n) => addDays('2026-11-02', n))

describe('planServices', () => {
  it('sends each working vehicle in once a fortnight, 08:00 to 14:00 Kyiv time', () => {
    const fleet = Array.from({ length: 30 }, (_, n) => vehicle(n))

    const services = fortnight.flatMap((day) =>
      planServices(day, fleet).map((service) => ({ day, ...service })),
    )

    expect(services.map(({ vehicleId }) => vehicleId).toSorted()).toEqual(
      fleet.map(({ id }) => id).toSorted(),
    )
    for (const service of services) {
      expect(service.startsAt).toEqual(fleetInstant(service.day, 8 * 60))
      expect(service.endsAt).toEqual(fleetInstant(service.day, 14 * 60))
    }
  })

  it('leaves vehicles that are out of service alone', () => {
    const fleet = [vehicle(1, { status: 'maintenance' }), vehicle(2, { status: 'inactive' })]

    expect(fortnight.flatMap((day) => planServices(day, fleet))).toEqual([])
  })
})
