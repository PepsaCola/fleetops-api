import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp, type App } from './build-app.ts'
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

  it('keeps the API for signed-in users', async () => {
    const read = await app.inject({ method: 'GET', url: '/api/v1/vehicles' })
    const change = await app.inject({
      method: 'POST',
      url: '/api/v1/trips/0199d2a4-5f3e-7c11-9a2b-3c4d5e6f7a8b/cancel',
    })

    expect(read.statusCode).toBe(401)
    expect(read.json()).toMatchObject({ code: 'UNAUTHORIZED' })
    expect(change.statusCode).toBe(401)
  })

  it('sends security headers', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN')
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
        '/api/v1/auth/login',
        '/api/v1/auth/logout',
        '/api/v1/auth/me',
        '/api/v1/vehicles',
        '/api/v1/vehicles/{vehicleId}',
        '/api/v1/drivers',
        '/api/v1/drivers/{driverId}',
        '/api/v1/trips',
        '/api/v1/trips/{tripId}',
        '/api/v1/tracking/positions',
        '/api/v1/tracking/routes',
      ]),
    )
    expect(schemaNames).toContain('ProblemDetails')
    // Unused "…Input" twins are pruned, so the generated client only gets real types
    expect(schemaNames.filter((name) => name.endsWith('Input'))).toEqual([])
    // The docs routes themselves are not part of the API
    expect(Object.keys(document.paths).filter((path) => path.startsWith('/docs'))).toEqual([])
  })

  it('serves the docs page, pointed at the OpenAPI document', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs' })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/html')
    expect(response.body).toContain("url: '/docs/json'")
  })
})
