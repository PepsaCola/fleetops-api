import { z } from 'zod'

import { userRole } from './auth.table.ts'

// A request body stays unnamed: a named schema would also appear as a "…Input" twin in the docs
export const LoginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
})

export const CurrentUserSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    name: z.string(),
    role: z.enum(userRole.enumValues).describe('Dispatchers change trips; viewers only look'),
  })
  .meta({ id: 'CurrentUser' })

export type CurrentUser = z.infer<typeof CurrentUserSchema>
