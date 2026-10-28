import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

import { CostQuerySchema, CostReportSchema } from './costs.schemas.ts'
import type { CostsService } from './costs.service.ts'

export type CostRoutesOptions = { service: CostsService }

export const costRoutes: FastifyPluginAsyncZod<CostRoutesOptions> = async (app, { service }) => {
  app.get(
    '/costs',
    {
      schema: {
        tags: ['costs'],
        operationId: 'getCostReport',
        summary: 'What the fleet spent on fuel and in the workshop, by day and by vehicle',
        querystring: CostQuerySchema,
        response: { 200: CostReportSchema },
      },
    },
    (request) => service.report(request.query),
  )
}
