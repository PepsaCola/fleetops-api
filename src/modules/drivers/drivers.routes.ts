import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

import {
  DriverListQuerySchema,
  DriverPageSchema,
  DriverParamsSchema,
  DriverSchema,
} from './drivers.schemas.ts'
import type { DriversService } from './drivers.service.ts'

export type DriverRoutesOptions = { service: DriversService }

export const driverRoutes: FastifyPluginAsyncZod<DriverRoutesOptions> = async (
  app,
  { service },
) => {
  app.get(
    '/drivers',
    {
      schema: {
        tags: ['drivers'],
        operationId: 'listDrivers',
        summary: 'List drivers with filters, sorting and pagination',
        querystring: DriverListQuerySchema,
        response: { 200: DriverPageSchema },
      },
    },
    (request) => service.list(request.query),
  )

  app.get(
    '/drivers/:driverId',
    {
      schema: {
        tags: ['drivers'],
        operationId: 'getDriver',
        summary: 'Get one driver',
        params: DriverParamsSchema,
        response: { 200: DriverSchema },
      },
    },
    (request) => service.get(request.params.driverId),
  )
}
