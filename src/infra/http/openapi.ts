import swagger, { type SwaggerTransformObject } from '@fastify/swagger'
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

// Swagger UI is loaded from a CDN, pinned with integrity hashes. @fastify/swagger-ui would serve
// the same files itself, but its @fastify/static dependency require()s an ESM-only package,
// which Vercel's Node runtime can't load.
const SWAGGER_UI = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.32.6'

const DOCS_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FleetOps API</title>
    <link
      rel="stylesheet"
      href="${SWAGGER_UI}/swagger-ui.css"
      integrity="sha384-9Q2fpS+xeS4ffJy6CagnwoUl+4ldAYhOs9pgZuEKxypVModhmZFzeMlvVsAjf7uT"
      crossorigin="anonymous"
    />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script
      src="${SWAGGER_UI}/swagger-ui-bundle.js"
      integrity="sha384-EYdOaiRwn44zNjrw+Tfs06qYz9BGQVo2f4/pLY5i7VorbjnZNhdplAbTBk8FXHUJ"
      crossorigin="anonymous"
    ></script>
    <script>
      SwaggerUIBundle({ url: '/docs/json', dom_id: '#swagger-ui' })
    </script>
  </body>
</html>
`

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
        { name: 'drivers', description: 'Drivers and their documents' },
        { name: 'tracking', description: 'Where the fleet is right now' },
      ],
    },
    transform: jsonSchemaTransform,
    transformObject: withoutUnusedSchemas(jsonSchemaTransformObject),
  })

  // The docs routes describe the API rather than belong to it, so they stay out of the document
  app.get('/docs/json', { schema: { hide: true } }, () => app.swagger())
  app.get('/docs', { schema: { hide: true } }, (_request, reply) =>
    reply.type('text/html').send(DOCS_PAGE),
  )
}
