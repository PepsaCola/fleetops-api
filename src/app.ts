import { randomUUID } from 'node:crypto'

import Fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'

import type { Config } from './config/env.ts'
import { createDatabase, type Database } from './infra/db/client.ts'
import { registerOpenApi } from './infra/http/openapi.ts'
import { healthRoutes } from './modules/health/index.ts'
import {
  createVehiclesRepository,
  createVehiclesService,
  vehicleRoutes,
} from './modules/vehicles/index.ts'
import { errorHandler, notFoundHandler } from './shared/http/error-handler.ts'
import { addProblemResponses } from './shared/http/problem-responses.ts'

function loggerOptions(config: Config) {
  if (config.env === 'test') return false
  if (config.env === 'development') {
    return {
      level: config.logLevel,
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    }
  }
  return { level: config.logLevel }
}

type Dependencies = {
  /** Pass a ready-made database to share it, e.g. between tests; created from config otherwise. */
  database?: Database
}

/**
 * Composition root: wires plugins, error handling and every module's routes.
 * It doesn't start listening, so tests can drive it with app.inject().
 */
export async function buildApp(config: Config, dependencies: Dependencies = {}) {
  const database = dependencies.database ?? createDatabase(config.databaseUrl)

  const app = Fastify({
    logger: loggerOptions(config),
    // Keep the caller's request id (e.g. from a proxy) so logs can be correlated across services
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
  }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  app.setErrorHandler(errorHandler)
  app.setNotFoundHandler(notFoundHandler)
  app.addHook('onRoute', addProblemResponses)
  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id)
  })
  // The app owns the connection pool it created: close it together with the server
  if (!dependencies.database) app.addHook('onClose', () => database.close())

  await registerOpenApi(app)
  await app.register(healthRoutes, { checkDatabase: database.ping })

  const vehicles = createVehiclesService({ repository: createVehiclesRepository(database.db) })
  await app.register(vehicleRoutes, { prefix: '/api/v1', service: vehicles })

  return app
}

export type App = Awaited<ReturnType<typeof buildApp>>
