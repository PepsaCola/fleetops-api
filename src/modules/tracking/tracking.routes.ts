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
        description: 'Simulated from the clock: the demo fleet drives fixed routes on a timetable.',
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
        summary: 'The roads the fleet drives, for drawing on the map',
        response: { 200: TrackingRoutesSchema },
      },
    },
    async (_request, reply) => {
      // The routes only change with a deploy
      reply.header('cache-control', 'public, max-age=3600')
      return service.routes()
    },
  )
}
