import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { ConflictError, NotFoundError } from '../errors.ts'
import { createTestServer } from './test-server.ts'

function buildTestApp() {
  const app = createTestServer()

  app.get('/trips/:tripId', () => {
    throw new NotFoundError('Trip', 'TR-9')
  })
  app.post('/trips/:tripId/assign', () => {
    throw new ConflictError('TRIP_CONFLICT', 'Vehicle AA 1234 KB is busy at that time', {
      conflictingTripId: 'TR-1041',
    })
  })
  app.post(
    '/vehicles',
    { schema: { body: z.object({ plate: z.string().min(1), capacityKg: z.number().positive() }) } },
    () => 'created',
  )
  app.get('/boom', () => {
    throw new Error('connection to db-internal:5432 refused')
  })
  return app
}

describe('errorHandler', () => {
  const app = buildTestApp()

  beforeAll(() => app.ready())
  afterAll(() => app.close())

  it('turns an AppError into Problem Details', async () => {
    const response = await app.inject({ method: 'GET', url: '/trips/TR-9' })

    expect(response.statusCode).toBe(404)
    expect(response.headers['content-type']).toContain('application/problem+json')
    expect(response.json()).toMatchObject({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      code: 'NOT_FOUND',
      detail: 'Trip TR-9 was not found',
    })
    expect(response.json().requestId).toEqual(expect.any(String))
  })

  it('passes conflict details to the client', async () => {
    const response = await app.inject({ method: 'POST', url: '/trips/TR-1042/assign' })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({
      code: 'TRIP_CONFLICT',
      details: { conflictingTripId: 'TR-1041' },
    })
  })

  it('lists invalid fields so a form can highlight them', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/vehicles',
      payload: { plate: '', capacityKg: -5 },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ code: 'VALIDATION_FAILED' })
    expect(Object.keys(response.json().errors)).toEqual(['plate', 'capacityKg'])
  })

  it('reports a malformed JSON body as a client error', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/vehicles',
      headers: { 'content-type': 'application/json' },
      payload: '{"plate":',
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().code).toMatch(/^FST_ERR/)
  })

  it('hides internal details of unexpected errors', async () => {
    const response = await app.inject({ method: 'GET', url: '/boom' })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toMatchObject({ code: 'INTERNAL_ERROR' })
    expect(response.body).not.toContain('db-internal')
  })
})
