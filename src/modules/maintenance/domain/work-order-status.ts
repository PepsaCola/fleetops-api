// A work order's status follows the clock, like a trip's: scheduled until the vehicle goes in,
// in progress while it's in the workshop, then done. Only a cancellation is recorded.

export const WORK_ORDER_STATUSES = ['scheduled', 'in_progress', 'done', 'cancelled'] as const
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number]

type WorkOrderTimes = { startsAt: Date; endsAt: Date; cancelledAt: Date | null }

export function workOrderStatus(order: WorkOrderTimes, now: Date): WorkOrderStatus {
  if (order.cancelledAt) return 'cancelled'
  if (now < order.startsAt) return 'scheduled'
  if (now < order.endsAt) return 'in_progress'
  return 'done'
}
