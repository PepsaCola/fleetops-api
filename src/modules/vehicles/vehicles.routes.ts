import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

import {
  VehicleListQuerySchema,
  VehiclePageSchema,
  VehicleParamsSchema,
  VehicleSchema,
} from './vehicles.schemas.ts'
import type { VehiclesService } from './vehicles.service.ts'

export type VehicleRoutesOptions = { service: VehiclesService }

export const vehicleRoutes: FastifyPluginAsyncZod<VehicleRoutesOptions> = async (
  app,
  { service },
) => {
  app.get(
    '/vehicles',
    {
      schema: {
        tags: ['vehicles'],
        operationId: 'listVehicles',
        summary: 'List vehicles with filters, sorting and pagination',
        querystring: VehicleListQuerySchema,
        response: { 200: VehiclePageSchema },
      },
    },
    (request) => service.list(request.query),
  )

  app.get(
    '/vehicles/:vehicleId',
    {
      schema: {
        tags: ['vehicles'],
        operationId: 'getVehicle',
        summary: 'Get one vehicle',
        params: VehicleParamsSchema,
        response: { 200: VehicleSchema },
      },
    },
    (request) => service.get(request.params.vehicleId),
  )
}
