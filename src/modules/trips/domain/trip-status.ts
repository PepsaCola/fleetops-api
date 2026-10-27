// A trip's status follows the clock: planned until it leaves the depot, in progress until it's
// back, then completed. Only a cancellation is recorded; everything else is worked out.

export const TRIP_STATUSES = ['planned', 'in_progress', 'completed', 'cancelled'] as const
export type TripStatus = (typeof TRIP_STATUSES)[number]

type TripTimes = { departsAt: Date; returnsAt: Date; cancelledAt: Date | null }

export function tripStatus(trip: TripTimes, now: Date): TripStatus {
  if (trip.cancelledAt) return 'cancelled'
  if (now < trip.departsAt) return 'planned'
  if (now < trip.returnsAt) return 'in_progress'
  return 'completed'
}
