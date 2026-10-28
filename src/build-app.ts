import { randomUUID } from 'node:crypto'

import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'

import type { Config } from './config/env.ts'
import { createDatabase, type Database } from './infra/db/client.ts'
import { registerOpenApi } from './infra/http/openapi.ts'
import {
  authRoutes,
  checkAccess,
  createAuthRepository,
  createAuthService,
  SESSION_COOKIE,
} from './modules/auth/index.ts'
import { costRoutes, createCostsService } from './modules/costs/index.ts'
import {
  createDriversRepository,
  createDriversService,
  driverRoutes,
} from './modules/drivers/index.ts'
import { healthRoutes } from './modules/health/index.ts'
import {
  createWorkOrdersRepository,
  createWorkOrdersService,
  workOrderRoutes,
} from './modules/maintenance/index.ts'
import { createTrackingService, trackingRoutes } from './modules/tracking/index.ts'
import { createTripsRepository, createTripsService, tripRoutes } from './modules/trips/index.ts'
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
  await app.register(cookie)
  // The API answers JSON; the one HTML page, /docs, loads Swagger UI from a CDN with an inline
  // script, so a Content-Security-Policy would only get in its way
  await app.register(helmet, { contentSecurityPolicy: false })
  // Off by default; routes that need a limit (signing in) set their own
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_request, context) =>
      Object.assign(new Error(`Too many attempts; try again in ${context.after}`), {
        statusCode: 429,
        code: 'TOO_MANY_REQUESTS',
      }),
  })
  await app.register(healthRoutes, { checkDatabase: database.ping })

  const auth = createAuthService({ repository: createAuthRepository(database.db) })
  await app.register(authRoutes, {
    prefix: '/api/v1',
    service: auth,
    secureCookies: config.env === 'production',
  })

  // Everything else in the API needs a signed-in user, and changing anything needs a dispatcher
  await app.register(
    async (api) => {
      api.addHook('onRequest', async (request) => {
        const user = await auth.authenticate(request.cookies[SESSION_COOKIE])
        request.currentUser = checkAccess(user, request.method)
      })

      const vehicles = createVehiclesService({ repository: createVehiclesRepository(database.db) })
      await api.register(vehicleRoutes, { service: vehicles })

      const drivers = createDriversService({ repository: createDriversRepository(database.db) })
      await api.register(driverRoutes, { service: drivers })

      // A vehicle can't be on a trip and in the workshop at once, so trips and work orders each
      // ask the other. Trips reach the work orders service through a function, called only once
      // requests arrive, by which time the service below exists.
      const trips = createTripsService({
        repository: createTripsRepository(database.db),
        listVehicles: vehicles.listWithDepots,
        listDrivers: drivers.listForPlanning,
        listWorkOrders: (from, to) => workOrders.listBetween(from, to),
      })
      const workOrders = createWorkOrdersService({
        repository: createWorkOrdersRepository(database.db),
        listVehicles: vehicles.listWithDepots,
        listTrips: trips.listOverlapping,
      })
      await api.register(tripRoutes, { service: trips })
      await api.register(workOrderRoutes, { service: workOrders })

      // Costs add up the trips' fuel and the workshop's bills
      const costs = createCostsService({
        listVehicles: vehicles.listWithDepots,
        listTrips: trips.listOnDays,
        listWorkOrders: async (from, to) =>
          (await workOrders.list({ from, to, status: 'done' })).items,
      })
      await api.register(costRoutes, { service: costs })

      // Tracking places the vehicles on the map from their trips and their time in the workshop
      const tracking = createTrackingService({
        listVehicles: vehicles.listWithDepots,
        listTrips: trips.listOverlapping,
        listWorkOrders: workOrders.listBetween,
      })
      await api.register(trackingRoutes, { service: tracking })
    },
    { prefix: '/api/v1' },
  )

  return app
}

export type App = Awaited<ReturnType<typeof buildApp>>
