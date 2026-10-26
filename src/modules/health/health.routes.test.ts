import { describe, expect, it } from 'vitest'

import { createTestServer } from '../../shared/http/test-server.ts'
import { healthRoutes } from './health.routes.ts'

async function serverWithDatabase(checkDatabase: () => Promise<void>) {
  const app = createTestServer()
  await app.register(healthRoutes, { checkDatabase })
  return app
}

describe('health routes', () => {
  it('is ready when the database answers', async () => {
    const app = await serverWithDatabase(async () => {})

    const response = await app.inject({ method: 'GET', url: '/ready' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ready' })
  })

  it('reports 503 when the database is down', async () => {
    const app = await serverWithDatabase(async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:5432')
    })

    const response = await app.inject({ method: 'GET', url: '/ready' })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toMatchObject({ code: 'SERVICE_UNAVAILABLE' })
    expect(response.body).not.toContain('ECONNREFUSED')
  })

  it('stays alive even when the database is down', async () => {
    const app = await serverWithDatabase(async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:5432')
    })

    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
  })
})
