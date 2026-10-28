// The rules a work order must keep. Whether the vehicle is free then (no trip, no other work
// order) is checked against the records: see the service and the repository.

/** The longest a vehicle is booked into the workshop at once; a longer job means taking it out of service */
export const LONGEST_WORK_ORDER_MS = 7 * 24 * 60 * 60_000

export type WorkshopBooking = {
  vehicle: { status: 'active' | 'maintenance' | 'inactive' }
  startsAt: Date
  endsAt: Date
}

/** Why a work order breaks the rules, or null when it keeps them all. */
export function workOrderProblem(booking: WorkshopBooking, now: Date) {
  if (booking.endsAt <= booking.startsAt) {
    return { code: 'ENDS_BEFORE_START', message: 'A work order has to end after it starts' }
  }
  if (booking.startsAt <= now) {
    return {
      code: 'START_IN_PAST',
      message: 'A work order can only be booked to start later than now',
    }
  }
  if (booking.endsAt.getTime() - booking.startsAt.getTime() > LONGEST_WORK_ORDER_MS) {
    return {
      code: 'WORK_ORDER_TOO_LONG',
      message:
        'A vehicle goes into the workshop for a week at most; take it out of service for longer jobs',
    }
  }
  if (booking.vehicle.status === 'inactive') {
    return { code: 'VEHICLE_RETIRED', message: 'The vehicle is out of service for good' }
  }
  return null
}
