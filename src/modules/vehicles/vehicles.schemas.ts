import { z } from 'zod'

import { pageOf, PageQuerySchema } from '../../shared/http/pagination.ts'
import { vehicleStatus, vehicleType } from './vehicles.table.ts'

// The enums come from the table, so the API and the database can't drift apart
const VehicleTypeSchema = z.enum(vehicleType.enumValues)
const VehicleStatusSchema = z.enum(vehicleStatus.enumValues)

export const VehicleSchema = z
  .object({
    id: z.uuid(),
    plate: z.string().describe('Ukrainian number plate, e.g. "AA 1234 KB"'),
    make: z.string(),
    model: z.string(),
    year: z.number().int(),
    type: VehicleTypeSchema,
    status: VehicleStatusSchema,
    capacityKg: z.number().int(),
    fuelTankL: z.number().int(),
    odometerKm: z.number().int(),
    homeDepot: z.object({ id: z.uuid(), name: z.string() }),
  })
  .meta({ id: 'Vehicle' })

export type Vehicle = z.infer<typeof VehicleSchema>

export const VehicleListQuerySchema = PageQuerySchema.extend({
  status: VehicleStatusSchema.optional(),
  type: VehicleTypeSchema.optional(),
  depotId: z.uuid().optional(),
  search: z.string().trim().max(50).optional().describe('Part of the plate, make or model'),
  sort: z
    .enum([
      'plate',
      '-plate',
      'year',
      '-year',
      'odometerKm',
      '-odometerKm',
      'capacityKg',
      '-capacityKg',
    ])
    .default('plate'),
})

export type VehicleListQuery = z.infer<typeof VehicleListQuerySchema>

export const VehiclePageSchema = pageOf(VehicleSchema).meta({ id: 'VehiclePage' })

export type VehiclePage = z.infer<typeof VehiclePageSchema>

export const VehicleParamsSchema = z.object({ vehicleId: z.uuid() })
