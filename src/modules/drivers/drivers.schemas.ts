import { z } from 'zod'

import { pageOf, PageQuerySchema } from '../../shared/http/pagination.ts'
import { DOCUMENT_STATES, EXPIRY_WARNING_DAYS } from './domain/documents.ts'
import { driverStatus } from './drivers.table.ts'

// The status enum comes from the table, so the API and the database can't drift apart
const DriverStatusSchema = z.enum(driverStatus.enumValues)
const DocumentStateSchema = z
  .enum(DOCUMENT_STATES)
  .describe(`"expiring": the first document runs out within ${EXPIRY_WARNING_DAYS} days`)

export const DriverSchema = z
  .object({
    id: z.uuid(),
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string().describe('International format, e.g. "+380671234567"'),
    licenseNumber: z.string(),
    licenseCategories: z.array(z.string()).describe('Licence categories, e.g. ["B", "C", "CE"]'),
    licenseExpiresOn: z.iso.date(),
    medicalExpiresOn: z.iso.date(),
    documentsExpireOn: z.iso.date().describe('The earlier of the two expiry dates'),
    documents: DocumentStateSchema,
    status: DriverStatusSchema,
    homeDepot: z.object({ id: z.uuid(), name: z.string() }),
  })
  .meta({ id: 'Driver' })

export type Driver = z.infer<typeof DriverSchema>

export const DriverListQuerySchema = PageQuerySchema.extend({
  status: DriverStatusSchema.optional(),
  depotId: z.uuid().optional(),
  documents: DocumentStateSchema.optional(),
  search: z
    .string()
    .trim()
    .max(50)
    .optional()
    .describe('Part of the name, phone or licence number'),
  sort: z
    .enum(['lastName', '-lastName', 'documentsExpireOn', '-documentsExpireOn'])
    .default('lastName'),
})

export type DriverListQuery = z.infer<typeof DriverListQuerySchema>

export const DriverPageSchema = pageOf(DriverSchema).meta({ id: 'DriverPage' })

export type DriverPage = z.infer<typeof DriverPageSchema>

export const DriverParamsSchema = z.object({ driverId: z.uuid() })
