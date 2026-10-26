import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp, type App } from './app.ts'
import { loadConfig } from './config/env.ts'

describe('app', () => {
  let app: App

  beforeAll(async () => {
    app = await buildApp(loadConfig({ NODE_ENV: 'test' }))
  })
  afterAll(() => app.close())

  it('reports that it is alive', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ status: 'ok' })
  })

  it('tags every response with a request id', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'trace-42' },
    })

    expect(response.headers['x-request-id']).toBe('trace-42')
  })

  it('answers unknown routes with Problem Details', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/nope' })

    expect(response.statusCode).toBe(404)
    expect(response.headers['content-type']).toContain('application/problem+json')
    expect(response.json()).toMatchObject({ status: 404, code: 'ROUTE_NOT_FOUND' })
  })

  it('publishes an OpenAPI 3.1 document of every module', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' })
    const document = response.json()
    const schemaNames = Object.keys(document.components.schemas)

    expect(document.openapi).toBe('3.1.0')
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        '/health',
        '/ready',
        '/api/v1/vehicles',
        '/api/v1/vehicles/{vehicleId}',
      ]),
    )
    expect(schemaNames).toContain('ProblemDetails')
    // Unused "…Input" twins are pruned, so the generated client only gets real types
    expect(schemaNames.filter((name) => name.endsWith('Input'))).toEqual([])
  })
})
