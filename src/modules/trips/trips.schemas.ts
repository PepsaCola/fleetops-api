import { z } from 'zod'

import { pageOf, PageQuerySchema } from '../../shared/http/pagination.ts'
import { ROUTE_KINDS } from '../tracking/index.ts'
import { vehicleType } from '../vehicles/vehicles.table.ts'
import { TRIP_STATUSES } from './domain/trip-status.ts'

const TripStatusSchema = z
  .enum(TRIP_STATUSES)
  .describe('Follows the clock: planned, then in_progress, then completed; or cancelled')

export const TripSchema = z
  .object({
    id: z.uuid(),
    number: z.number().int().describe('Short trip number to read out, e.g. 1042'),
    status: TripStatusSchema,
    vehicle: z.object({ id: z.uuid(), plate: z.string(), type: z.enum(vehicleType.enumValues) }),
    driver: z.object({ id: z.uuid(), firstName: z.string(), lastName: z.string() }),
    route: z.object({ id: z.string(), name: z.string(), kind: z.enum(ROUTE_KINDS) }),
    departsAt: z.iso.datetime().describe('Leaves the depot'),
    arrivesAt: z.iso.datetime().describe('Reaches the customer'),
    returnsAt: z.iso.datetime().describe('Back at the depot'),
    cancelledAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'Trip' })

export type Trip = z.infer<typeof TripSchema>

export const TripListQuerySchema = PageQuerySchema.extend({
  day: z.iso.date().optional().describe('Trips leaving on this day, Kyiv time; today by default'),
  status: TripStatusSchema.optional(),
  vehicleId: z.uuid().optional(),
  driverId: z.uuid().optional(),
  sort: z.enum(['departsAt', '-departsAt', 'number', '-number']).default('departsAt'),
})

export type TripListQuery = z.infer<typeof TripListQuerySchema>

export const TripPageSchema = pageOf(TripSchema).meta({ id: 'TripPage' })

export type TripPage = z.infer<typeof TripPageSchema>

export const TripParamsSchema = z.object({ tripId: z.uuid() })
