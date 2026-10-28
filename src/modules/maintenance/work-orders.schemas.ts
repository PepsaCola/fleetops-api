import { z } from 'zod'

import { vehicleType } from '../vehicles/vehicles.table.ts'
import { WORK_ORDER_STATUSES } from './domain/work-order-status.ts'
import { workOrderKind } from './work-orders.table.ts'

const WorkOrderStatusSchema = z
  .enum(WORK_ORDER_STATUSES)
  .describe('Follows the clock: scheduled, then in_progress, then done; or cancelled')
const WorkOrderKindSchema = z.enum(workOrderKind.enumValues)

export const WorkOrderSchema = z
  .object({
    id: z.uuid(),
    number: z.number().int().describe('Short work order number, e.g. 5012'),
    kind: WorkOrderKindSchema,
    status: WorkOrderStatusSchema,
    vehicle: z.object({ id: z.uuid(), plate: z.string(), type: z.enum(vehicleType.enumValues) }),
    startsAt: z.iso.datetime().describe('In the workshop from'),
    endsAt: z.iso.datetime().describe('In the workshop until; no trips for the vehicle in between'),
    costUah: z.number().int().describe('What the work costs, in whole hryvnias'),
    note: z.string(),
    cancelledAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'WorkOrder' })

export type WorkOrder = z.infer<typeof WorkOrderSchema>
export type WorkOrderKind = WorkOrder['kind']

export const WorkOrderListQuerySchema = z.object({
  from: z.iso.date().describe('The first day, Kyiv time'),
  to: z.iso.date().describe('The last day, Kyiv time; at most 62 days from `from`'),
  vehicleId: z.uuid().optional(),
  status: WorkOrderStatusSchema.optional(),
})

export type WorkOrderListQuery = z.infer<typeof WorkOrderListQuerySchema>

export const WorkOrderListSchema = z
  .object({
    items: z.array(WorkOrderSchema).describe('Every work order touching those days, by start'),
  })
  .meta({ id: 'WorkOrderList' })

export type WorkOrderList = z.infer<typeof WorkOrderListSchema>

export const WorkOrderParamsSchema = z.object({ workOrderId: z.uuid() })

// Request bodies stay unnamed: a named schema would also appear as a "…Input" twin in the docs
export const WorkOrderCreateSchema = z.object({
  vehicleId: z.uuid(),
  kind: WorkOrderKindSchema,
  startsAt: z.iso.datetime({ offset: true }).describe('Must be later than now'),
  endsAt: z.iso.datetime({ offset: true }).describe('At most a week after the start'),
  costUah: z.number().int().min(0).max(10_000_000),
  note: z.string().trim().max(500).optional(),
})

export type WorkOrderCreate = z.infer<typeof WorkOrderCreateSchema>

export const WorkOrderUpdateSchema = WorkOrderCreateSchema.partial()

export type WorkOrderUpdate = z.infer<typeof WorkOrderUpdateSchema>
