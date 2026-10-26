import type { RouteOptions } from 'fastify'

import { ProblemDetailsSchema } from './problem.ts'

const problemResponse = {
  description: 'Problem Details (RFC 9457)',
  content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
}

/**
 * onRoute hook: every route that documents its responses can also fail with Problem Details,
 * so declare that once here instead of in each route. A route can still override 4xx/5xx.
 */
export function addProblemResponses(route: RouteOptions) {
  const schema = route.schema
  if (!schema || typeof schema.response !== 'object' || schema.response === null) return

  schema.response = { '4xx': problemResponse, '5xx': problemResponse, ...schema.response }
}
