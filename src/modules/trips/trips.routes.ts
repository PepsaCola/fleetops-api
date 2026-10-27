import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

import {
  TripListQuerySchema,
  TripPageSchema,
  TripParamsSchema,
  TripSchema,
} from './trips.schemas.ts'
import type { TripsService } from './trips.service.ts'

export type TripRoutesOptions = { service: TripsService }

export const tripRoutes: FastifyPluginAsyncZod<TripRoutesOptions> = async (app, { service }) => {
  app.get(
    '/trips',
    {
      schema: {
        tags: ['trips'],
        operationId: 'listTrips',
        summary: 'List the trips of a day with filters, sorting and pagination',
        querystring: TripListQuerySchema,
        response: { 200: TripPageSchema },
      },
    },
    (request) => service.list(request.query),
  )

  app.get(
    '/trips/:tripId',
    {
      schema: {
        tags: ['trips'],
        operationId: 'getTrip',
        summary: 'Get one trip',
        params: TripParamsSchema,
        response: { 200: TripSchema },
      },
    },
    (request) => service.get(request.params.tripId),
  )
}
