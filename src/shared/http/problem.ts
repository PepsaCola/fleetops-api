import { z } from 'zod'

/** RFC 9457 Problem Details — the body of every error response the API sends. */
export const ProblemDetailsSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string().optional(),
    code: z.string().describe('Machine-readable reason, e.g. TRIP_CONFLICT'),
    errors: z
      .record(z.string(), z.array(z.string()))
      .optional()
      .describe('Validation messages keyed by field path'),
    details: z.record(z.string(), z.unknown()).optional().describe('Extra data about the problem'),
    requestId: z.string().optional().describe('Quote this id when reporting the problem'),
  })
  .meta({ id: 'ProblemDetails' })

export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>
