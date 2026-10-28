import { stableHash } from '../../../shared/stable-hash.ts'
import { fleetInstant, type IsoDate } from '../../../shared/time/fleet-time.ts'

// Routine services keep the demo workshop busy the way a real one is: every working vehicle
// goes in once a fortnight, on a day set by its id, so a few are in on any given day.

export type ServicedVehicle = {
  id: string
  type: 'truck' | 'van' | 'car'
  status: 'active' | 'maintenance' | 'inactive'
}

/** Every working vehicle has a routine service this often, in days */
export const SERVICE_EVERY_DAYS = 14

/** What a routine service costs, in hryvnias: bigger vehicles, bigger bills */
const SERVICE_COST_UAH: Record<ServicedVehicle['type'], number> = {
  truck: 9_800,
  van: 4_800,
  car: 3_200,
}

const DAY_MS = 24 * 60 * 60_000

/** The routine services of a day: in the workshop from 08:00 to 14:00, Kyiv time. */
export function planServices(day: IsoDate, vehicles: ServicedVehicle[]) {
  const dayNumber = Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS)

  return vehicles
    .filter(
      (vehicle) =>
        vehicle.status === 'active' &&
        stableHash(vehicle.id) % SERVICE_EVERY_DAYS === dayNumber % SERVICE_EVERY_DAYS,
    )
    .map((vehicle) => ({
      vehicleId: vehicle.id,
      kind: 'service' as const,
      startsAt: fleetInstant(day, 8 * 60),
      endsAt: fleetInstant(day, 14 * 60),
      costUah: SERVICE_COST_UAH[vehicle.type],
      note: 'Routine service',
    }))
}
