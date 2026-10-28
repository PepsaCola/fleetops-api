import { ForbiddenError, UnauthorizedError } from '../../shared/errors.ts'
import type { SessionUser } from './auth.repository.ts'

declare module 'fastify' {
  interface FastifyRequest {
    /** Who made the request; set on every request behind the API's access check */
    currentUser?: SessionUser
  }
}

/** Requests that only read; any other method changes something */
const READS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Who may do what: anything needs a signed-in user (401 otherwise), and changing anything needs
 * a dispatcher (403 for a viewer). One rule for every endpoint, so new ones are covered too.
 */
export function checkAccess(user: SessionUser | null, method: string): SessionUser {
  if (!user) throw new UnauthorizedError()
  if (!READS.has(method) && user.role !== 'dispatcher') {
    throw new ForbiddenError('Viewers can look around but not change anything')
  }
  return user
}

/**
 * Changes must come from FleetOps's own pages. The session cookie also travels with requests
 * other sites start (it has to, to work inside their iframes), so a change the browser marks as
 * started elsewhere (Sec-Fetch-Site) is refused. Callers that send no such header, like curl or
 * tests, aren't browsers and carry nobody else's cookie.
 */
export function checkRequestSite(method: string, fetchSite: string | undefined) {
  if (READS.has(method) || fetchSite === undefined || fetchSite === 'same-origin') return
  throw new ForbiddenError('Changes can only be made from FleetOps itself')
}
