import { describe, expect, it } from 'vitest'

import { tripFuel } from './fuel.ts'
import { costReport, type CostTrip, type CostVehicle } from './report.ts'

const NOW = new Date('2026-10-28T10:00:00Z')
const van: CostVehicle = { id: 'van', plate: 'AA 1234 KB', type: 'van' }
const truck: CostVehicle = { id: 'truck', plate: 'AI 5678 KA', type: 'truck' }
const routes = [{ id: 'route-50', lengthKm: 50 }]

const trip = (vehicleId: string, departsAt: string, returnsAt: string): CostTrip => ({
  vehicleId,
  routeId: 'route-50',
  departsAt: new Date(departsAt),
  returnsAt: new Date(returnsAt),
})

describe('costs', () => {
  it('works out a trip’s fuel from there and back, at the vehicle’s burn', () => {
    // 100 km at 11 l/100 km is 11 litres, at 98 ₴ a litre
    expect(tripFuel(50, 'van')).toEqual({ km: 100, uah: 1078 })
    expect(tripFuel(50, 'truck')).toEqual({ km: 100, uah: 2744 })
  })

  it('adds up what was spent each day and by each vehicle, dearest first', () => {
    const report = costReport({
      days: ['2026-10-27', '2026-10-28'],
      vehicles: [van, truck],
      trips: [
        trip('van', '2026-10-27T06:00:00Z', '2026-10-27T08:00:00Z'),
        trip('truck', '2026-10-28T05:00:00Z', '2026-10-28T09:00:00Z'),
        // Still on the road at NOW: nothing counted yet
        trip('van', '2026-10-28T09:00:00Z', '2026-10-28T11:00:00Z'),
        // Left the day before the report starts
        trip('van', '2026-10-26T06:00:00Z', '2026-10-26T08:00:00Z'),
      ],
      workOrders: [{ vehicle: { id: 'van' }, startsAt: '2026-10-28T06:00:00Z', costUah: 4800 }],
      routes,
      now: NOW,
    })

    expect(report.days).toEqual([
      { day: '2026-10-27', fuelUah: 1078, maintenanceUah: 0 },
      { day: '2026-10-28', fuelUah: 2744, maintenanceUah: 4800 },
    ])
    expect(report.totals).toEqual({ km: 200, fuelUah: 3822, maintenanceUah: 4800 })
    expect(
      report.vehicles.map(({ vehicle, fuelUah, maintenanceUah }) => [
        vehicle.plate,
        fuelUah,
        maintenanceUah,
      ]),
    ).toEqual([
      ['AA 1234 KB', 1078, 4800],
      ['AI 5678 KA', 2744, 0],
    ])
  })
})
