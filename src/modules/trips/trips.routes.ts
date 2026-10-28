import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

import {
  TripCreateSchema,
  TripListQuerySchema,
  TripPageSchema,
  TripParamsSchema,
  TripSchema,
  TripUpdateSchema,
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

  app.post(
    '/trips',
    {
      schema: {
        tags: ['trips'],
        operationId: 'createTrip',
        summary: 'Book a trip; 409 when the vehicle or the driver is busy then',
        body: TripCreateSchema,
        response: { 201: TripSchema },
      },
    },
    async (request, reply) => reply.code(201).send(await service.create(request.body)),
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

  app.patch(
    '/trips/:tripId',
    {
      schema: {
        tags: ['trips'],
        operationId: 'updateTrip',
        summary: 'Move a planned trip to another time, vehicle, driver or route',
        params: TripParamsSchema,
        body: TripUpdateSchema,
        response: { 200: TripSchema },
      },
    },
    (request) => service.update(request.params.tripId, request.body),
  )

  app.post(
    '/trips/:tripId/cancel',
    {
      schema: {
        tags: ['trips'],
        operationId: 'cancelTrip',
        summary: 'Cancel a planned trip; it stays on record and frees the vehicle and the driver',
        params: TripParamsSchema,
        response: { 200: TripSchema },
      },
    },
    (request) => service.cancel(request.params.tripId),
  )
}
