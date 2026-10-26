import Fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'

import { errorHandler, notFoundHandler } from './error-handler.ts'
import { addProblemResponses } from './problem-responses.ts'

/**
 * A bare Fastify instance with the same validation and error handling as the real app.
 * Tests register one module's routes on it and drive them with inject(), without a database.
 */
export function createTestServer() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>()
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  app.setErrorHandler(errorHandler)
  app.setNotFoundHandler(notFoundHandler)
  app.addHook('onRoute', addProblemResponses)
  return app
}
