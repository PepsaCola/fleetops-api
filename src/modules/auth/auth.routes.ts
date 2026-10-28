import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { UnauthorizedError } from '../../shared/errors.ts'
import { CurrentUserSchema, LoginSchema } from './auth.schemas.ts'
import type { AuthService } from './auth.service.ts'

/** The cookie that carries the session token */
export const SESSION_COOKIE = 'fleetops_session'

export type AuthRoutesOptions = {
  service: AuthService
  /** Secure cookies travel over HTTPS only: on in production, off for http://localhost */
  secureCookies: boolean
}

export const authRoutes: FastifyPluginAsyncZod<AuthRoutesOptions> = async (
  app,
  { service, secureCookies },
) => {
  // httpOnly keeps the token away from scripts; SameSite=Lax keeps it off other sites' requests
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies,
  } as const

  app.post(
    '/auth/login',
    {
      schema: {
        tags: ['auth'],
        operationId: 'login',
        summary: 'Sign in; the session is kept in an httpOnly cookie',
        body: LoginSchema,
        response: { 200: CurrentUserSchema },
      },
      // Slows down password guessing; counted per IP, in each server instance's memory
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { token, expiresAt, user } = await service.login(
        request.body.email,
        request.body.password,
      )
      reply.setCookie(SESSION_COOKIE, token, { ...cookieOptions, expires: expiresAt })
      return user
    },
  )

  app.post(
    '/auth/logout',
    {
      schema: {
        tags: ['auth'],
        operationId: 'logout',
        summary: 'Sign out of this browser',
        response: { 204: z.null().describe('Signed out') },
      },
    },
    async (request, reply) => {
      await service.logout(request.cookies[SESSION_COOKIE])
      reply.clearCookie(SESSION_COOKIE, cookieOptions)
      return reply.code(204).send(null)
    },
  )

  app.get(
    '/auth/me',
    {
      schema: {
        tags: ['auth'],
        operationId: 'getCurrentUser',
        summary: 'Who is signed in; 401 when nobody is',
        response: { 200: CurrentUserSchema },
      },
    },
    async (request) => {
      const user = await service.authenticate(request.cookies[SESSION_COOKIE])
      if (!user) throw new UnauthorizedError()
      return user
    },
  )
}
