import { z } from 'zod'

import { vehicleType } from '../vehicles/vehicles.table.ts'

const Hryvnias = z.number().int().describe('Whole hryvnias')

export const CostQuerySchema = z.object({
  from: z.iso.date().describe('The first day, Kyiv time'),
  to: z.iso.date().describe('The last day, Kyiv time; at most 62 days from `from`'),
})

export type CostQuery = z.infer<typeof CostQuerySchema>

export const CostReportSchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    dieselUahPerLitre: z.number().describe('The fuel price the report counts with'),
    totals: z.object({ km: z.number().int(), fuelUah: Hryvnias, maintenanceUah: Hryvnias }),
    days: z
      .array(z.object({ day: z.iso.date(), fuelUah: Hryvnias, maintenanceUah: Hryvnias }))
      .describe('Every day of the period, in order'),
    vehicles: z
      .array(
        z.object({
          vehicle: z.object({
            id: z.uuid(),
            plate: z.string(),
            type: z.enum(vehicleType.enumValues),
          }),
          km: z.number().int(),
          fuelUah: Hryvnias,
          maintenanceUah: Hryvnias,
        }),
      )
      .describe('The vehicles that cost anything, the dearest first'),
  })
  .meta({ id: 'CostReport' })

export type CostReport = z.infer<typeof CostReportSchema>
