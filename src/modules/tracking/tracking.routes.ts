import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

import { FleetPositionsSchema, TrackingRoutesSchema } from './tracking.schemas.ts'
import type { TrackingService } from './tracking.service.ts'

export type TrackingRoutesOptions = { service: TrackingService }

export const trackingRoutes: FastifyPluginAsyncZod<TrackingRoutesOptions> = async (
  app,
  { service },
) => {
  app.get(
    '/tracking/positions',
    {
      schema: {
        tags: ['tracking'],
        operationId: 'getFleetPositions',
        summary: 'Where every vehicle is right now',
        description: 'Worked out from the trips and the clock: the demo fleet has no trackers.',
        response: { 200: FleetPositionsSchema },
      },
    },
    async (_request, reply) => {
      // A position is out of date a second later, so no cache may keep it
      reply.header('cache-control', 'no-store')
      return service.positions()
    },
  )

  app.get(
    '/tracking/routes',
    {
      schema: {
        tags: ['tracking'],
        operationId: 'listTrackingRoutes',
        summary: 'The roads the fleet drives, with how long a trip on each takes',
        response: { 200: TrackingRoutesSchema },
      },
    },
    async (_request, reply) => {
      // The routes change only with a deploy, but then they may change shape, so browsers must
      // not answer from an old copy. They're small, and a page asks for them once.
      reply.header('cache-control', 'no-cache')
      return service.routes()
    },
  )
}
