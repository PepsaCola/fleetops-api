import swagger, { type SwaggerTransformObject } from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import type { FastifyInstance } from 'fastify'
import { jsonSchemaTransform, jsonSchemaTransformObject } from 'fastify-type-provider-zod'

export const API_VERSION = '0.1.0'

type DocumentShape = { paths?: unknown; components?: { schemas?: Record<string, unknown> } }

const SCHEMA_REF = /"#\/components\/schemas\/([^"]+)"/g

/**
 * The Zod transform emits an "…Input" twin of every named schema, even when nothing uses it.
 * Keep only the schemas that routes reference (directly or through other schemas), so the docs
 * and the client generated from them stay free of noise.
 */
const withoutUnusedSchemas =
  (transform: SwaggerTransformObject): SwaggerTransformObject =>
  (input) => {
    const document = transform(input) as DocumentShape
    const schemas = document.components?.schemas ?? {}

    const used = new Set<string>()
    const pending = [JSON.stringify(document.paths ?? {})]
    for (let json = pending.pop(); json !== undefined; json = pending.pop()) {
      for (const [, name] of json.matchAll(SCHEMA_REF)) {
        if (name && !used.has(name) && name in schemas) {
          used.add(name)
          pending.push(JSON.stringify(schemas[name]))
        }
      }
    }

    const usedSchemas = Object.fromEntries(
      Object.entries(schemas).filter(([name]) => used.has(name)),
    )
    return {
      ...document,
      components: { ...document.components, schemas: usedSchemas },
    } as ReturnType<SwaggerTransformObject>
  }

/**
 * OpenAPI document built from the routes' Zod schemas, served at /docs (UI) and /docs/json.
 * Registered on the root instance, before any routes, so it sees all of them.
 */
export async function registerOpenApi(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'FleetOps API',
        description: 'Fleet operations: vehicles, drivers, trips, maintenance and costs.',
        version: API_VERSION,
      },
      tags: [
        { name: 'system', description: 'Health and service info' },
        { name: 'vehicles', description: 'Fleet vehicles' },
      ],
    },
    transform: jsonSchemaTransform,
    transformObject: withoutUnusedSchemas(jsonSchemaTransformObject),
  })
  await app.register(swaggerUi, { routePrefix: '/docs' })
}
