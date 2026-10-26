import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { ServiceUnavailableError } from '../../shared/errors.ts'

const HealthSchema = z
  .object({
    status: z.literal('ok'),
    uptime: z.number().int().describe('Seconds since the process started'),
  })
  .meta({ id: 'Health' })

const ReadySchema = z.object({ status: z.literal('ready') }).meta({ id: 'Ready' })

export type HealthRoutesOptions = {
  /** Resolves when the database answers, rejects otherwise. */
  checkDatabase: () => Promise<void>
}

export const healthRoutes: FastifyPluginAsyncZod<HealthRoutesOptions> = async (
  app,
  { checkDatabase },
) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['system'],
        summary: 'Liveness probe: the process is up and serving requests',
        response: { 200: HealthSchema },
      },
    },
    async () => ({ status: 'ok' as const, uptime: Math.round(process.uptime()) }),
  )

  app.get(
    '/ready',
    {
      schema: {
        tags: ['system'],
        summary: 'Readiness probe: the API can reach its database',
        response: { 200: ReadySchema },
      },
    },
    async (request) => {
      try {
        await checkDatabase()
      } catch (error) {
        request.log.warn({ err: error }, 'Database check failed')
        throw new ServiceUnavailableError('The database is not reachable')
      }
      return { status: 'ready' as const }
    },
  )
}
