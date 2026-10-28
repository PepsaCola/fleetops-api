import cookie from '@fastify/cookie'
import { describe, expect, it, vi } from 'vitest'

import { UnauthorizedError } from '../../shared/errors.ts'
import { createTestServer } from '../../shared/http/test-server.ts'
import { authRoutes } from './auth.routes.ts'
import type { AuthService } from './auth.service.ts'

const user = {
  id: '0199d2a4-0000-7000-8000-000000000001',
  email: 'dispatcher@fleetops.demo',
  name: 'Demo Dispatcher',
  role: 'dispatcher' as const,
}

async function serverWith(service: Partial<AuthService>) {
  const app = createTestServer()
  await app.register(cookie)
  await app.register(authRoutes, {
    prefix: '/api/v1',
    service: service as AuthService,
    secureCookies: true,
  })
  return app
}

describe('auth routes', () => {
  it('signs in, keeping the session in an httpOnly cookie', async () => {
    const login = vi.fn<AuthService['login']>(async () => ({
      token: 'token-1',
      expiresAt: new Date('2026-11-04T10:00:00Z'),
      user,
    }))
    const app = await serverWith({ login })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: user.email, password: 'fleetops-demo' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(user)
    expect(response.cookies[0]).toMatchObject({
      name: 'fleetops_session',
      value: 'token-1',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    })
  })

  it('answers 401 Problem Details for a wrong password', async () => {
    const login = vi.fn<AuthService['login']>(async () => {
      throw new UnauthorizedError('Wrong email or password')
    })
    const app = await serverWith({ login })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: user.email, password: 'guess' },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({ code: 'UNAUTHORIZED' })
    expect(response.cookies).toEqual([])
  })

  it('tells who is signed in from the cookie, and answers 401 without one', async () => {
    const authenticate = vi.fn<AuthService['authenticate']>(async (token) =>
      token === 'token-1' ? user : null,
    )
    const app = await serverWith({ authenticate })

    const signedIn = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      cookies: { fleetops_session: 'token-1' },
    })
    const anonymous = await app.inject({ method: 'GET', url: '/api/v1/auth/me' })

    expect(signedIn.json()).toEqual(user)
    expect(anonymous.statusCode).toBe(401)
  })

  it('signs out, ending the session and clearing the cookie', async () => {
    const logout = vi.fn<AuthService['logout']>(async () => undefined)
    const app = await serverWith({ logout })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      cookies: { fleetops_session: 'token-1' },
    })

    expect(response.statusCode).toBe(204)
    expect(logout).toHaveBeenCalledWith('token-1')
    expect(response.cookies[0]).toMatchObject({ name: 'fleetops_session', value: '' })
  })
})
