import { fleetToday } from '../../../shared/time/fleet-time.ts'
import { routesFrom, type PreparedRoute } from '../../tracking/index.ts'
import { LICENSE_FOR, type PlanningDriver, type PlanningVehicle } from './timetable.ts'

// The rules a trip booked by hand must keep: the same ones the usual timetable is planned by.
// Whether the vehicle and the driver are free at that time is the database's call (see the repository).

export type BookingProblem = { code: string; message: string }

export type TripBooking = {
  vehicle: PlanningVehicle
  driver: PlanningDriver
  route: PreparedRoute
  departsAt: Date
  returnsAt: Date
}

/** Why a booking breaks the fleet's rules, or null when it keeps them all. */
export function bookingProblem(
  booking: TripBooking,
  routes: PreparedRoute[],
  now: Date,
): BookingProblem | null {
  const { vehicle, driver, route } = booking

  if (booking.departsAt <= now) {
    return {
      code: 'DEPARTURE_IN_PAST',
      message: 'A trip can only be booked to leave later than now',
    }
  }
  if (vehicle.status !== 'active') {
    const state = vehicle.status === 'maintenance' ? 'in maintenance' : 'out of service'
    return { code: 'VEHICLE_UNAVAILABLE', message: `The vehicle is ${state}` }
  }
  if (!routesFrom(vehicle, routes).some((allowed) => allowed.id === route.id)) {
    return {
      code: 'ROUTE_NOT_ALLOWED',
      message: `A ${vehicle.type} from this depot doesn't drive "${route.name}"`,
    }
  }
  if (driver.status !== 'active') {
    const state = driver.status === 'on_leave' ? 'is on leave' : 'no longer drives for the fleet'
    return { code: 'DRIVER_UNAVAILABLE', message: `The driver ${state}` }
  }
  const category = LICENSE_FOR[vehicle.type]
  if (!driver.licenseCategories.includes(category)) {
    return {
      code: 'LICENSE_CATEGORY_MISSING',
      message: `Driving a ${vehicle.type} takes a category ${category} licence`,
    }
  }
  // The documents must stay valid until the vehicle is back, by the fleet's calendar
  const lastDay = fleetToday(booking.returnsAt)
  if (driver.licenseExpiresOn < lastDay || driver.medicalExpiresOn < lastDay) {
    return {
      code: 'DRIVER_DOCUMENTS_EXPIRED',
      message: "The driver's licence or medical certificate runs out before the trip is over",
    }
  }
  return null
}
