import { z } from 'zod'

/** `?page=1&pageSize=20` — shared by every list endpoint. */
export const PageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe('1-based page number'),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type PageQuery = z.infer<typeof PageQuerySchema>

/** The response of a list endpoint: one page of `item` plus the total across all pages. */
export const pageOf = <Item extends z.ZodType>(item: Item) =>
  z.object({
    items: z.array(item),
    total: z.number().int().describe('Items matching the filters, across all pages'),
    page: z.number().int(),
    pageSize: z.number().int(),
  })

export const pageOffset = ({ page, pageSize }: PageQuery) => (page - 1) * pageSize

/** `"odometerKm"` sorts ascending, `"-odometerKm"` descending. */
export function parseSort<Field extends string>(sort: Field | `-${Field}`) {
  const descending = sort.startsWith('-')
  return { field: (descending ? sort.slice(1) : sort) as Field, descending }
}
