import { stableHash } from '../../../shared/stable-hash.ts'
import { fleetInstant, type IsoDate } from '../../../shared/time/fleet-time.ts'
import { routesFrom, type PreparedRoute } from '../../tracking/index.ts'

// The usual working day of the fleet. Every vehicle that can work gets a driver, from its own
// depot when one is free, and they drive trip after trip through one shift. Dispatchers change
// trips from there.

export type PlanningVehicle = {
  id: string
  type: 'truck' | 'van' | 'car'
  status: 'active' | 'maintenance' | 'inactive'
  homeDepot: { id: string; location: { lng: number; lat: number } }
}

export type PlanningDriver = {
  id: string
  status: 'active' | 'on_leave' | 'inactive'
  homeDepotId: string
  licenseCategories: string[]
  licenseExpiresOn: IsoDate
  medicalExpiresOn: IsoDate
}

export type PlannedTrip = {
  vehicleId: string
  driverId: string
  routeId: string
  departsAt: Date
  returnsAt: Date
}

type Fleet = { vehicles: PlanningVehicle[]; drivers: PlanningDriver[]; routes: PreparedRoute[] }

const MINUTE = 60_000
/** A driver's working day; a trip that wouldn't be back by its end isn't planned */
const SHIFT_MS = 10 * 60 * MINUTE
/** Loading, refuelling and paperwork at the depot between two trips */
const TURNAROUND_MS = 40 * MINUTE
/** Trucks need category C; vans and cars are driven on a B licence */
const LICENSE_FOR: Record<PlanningVehicle['type'], string> = { truck: 'C', van: 'B', car: 'B' }

/** When the vehicle's shift starts, in minutes after midnight, always on a quarter hour. */
function shiftStart(vehicle: PlanningVehicle) {
  const quarter = stableHash(vehicle.id)
  // Trucks run long hauls round the clock in staggered shifts; vans and cars work days
  return vehicle.type === 'truck' ? (quarter % 96) * 15 : 6 * 60 + (quarter % 33) * 15
}

/**
 * Pairs each vehicle that can work with a driver who may drive it that day. A driver from the
 * vehicle's own depot comes first; a depot short of drivers borrows a free one from another.
 */
function crewsFor(day: IsoDate, vehicles: PlanningVehicle[], drivers: PlanningDriver[]) {
  const available = drivers
    .filter(
      (driver) =>
        driver.status === 'active' &&
        driver.licenseExpiresOn >= day &&
        driver.medicalExpiresOn >= day,
    )
    .toSorted((a, b) => a.id.localeCompare(b.id))
  const taken = new Set<string>()
  // Trucks choose first: fewer drivers hold the C category they need
  const working = vehicles
    .filter((vehicle) => vehicle.status === 'active')
    .toSorted(
      (a, b) => Number(b.type === 'truck') - Number(a.type === 'truck') || a.id.localeCompare(b.id),
    )

  return working.flatMap((vehicle) => {
    const free = (candidate: PlanningDriver) =>
      !taken.has(candidate.id) && candidate.licenseCategories.includes(LICENSE_FOR[vehicle.type])
    const driver =
      available.find(
        (candidate) => free(candidate) && candidate.homeDepotId === vehicle.homeDepot.id,
      ) ?? available.find(free)
    if (!driver) return []
    taken.add(driver.id)
    return [{ vehicle, driver }]
  })
}

/** The usual trips of a day; the same inputs always give the same plan. */
export function planDay(day: IsoDate, { vehicles, drivers, routes }: Fleet): PlannedTrip[] {
  return crewsFor(day, vehicles, drivers).flatMap(({ vehicle, driver }) => {
    const choices = routesFrom(vehicle, routes)
    const shiftStarts = fleetInstant(day, shiftStart(vehicle)).getTime()
    const trips: PlannedTrip[] = []

    for (let departs = shiftStarts; ;) {
      // Each trip of the day goes to one of the customers the vehicle serves
      const route = choices[stableHash(`${vehicle.id} ${day} ${trips.length}`) % choices.length]
      if (!route || departs + route.roundTripMs > shiftStarts + SHIFT_MS) break

      trips.push({
        vehicleId: vehicle.id,
        driverId: driver.id,
        routeId: route.id,
        departsAt: new Date(departs),
        returnsAt: new Date(departs + route.roundTripMs),
      })
      departs += route.roundTripMs + TURNAROUND_MS
    }
    return trips
  })
}
