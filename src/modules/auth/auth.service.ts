import { UnauthorizedError } from '../../shared/errors.ts'
import type { AuthRepository } from './auth.repository.ts'
import { hashPassword, verifyPassword } from './domain/password.ts'
import { hashSessionToken, newSessionToken, SESSION_TTL_MS } from './domain/session-token.ts'

type Dependencies = {
  repository: AuthRepository
  /** The current time; tests pass a fixed one */
  now?: () => Date
}

// An unknown email is checked against this hash, so it takes as long to refuse as a wrong
// password: the time of an answer doesn't tell which emails have an account
let decoyHash: Promise<string> | undefined
const decoy = () => (decoyHash ??= hashPassword('not anyone’s password'))

export function createAuthService({ repository, now = () => new Date() }: Dependencies) {
  return {
    /** Checks the password and starts a session; the token goes to the browser only. */
    async login(email: string, password: string) {
      const user = await repository.findUserByEmail(email)
      const matches = await verifyPassword(password, user?.passwordHash ?? (await decoy()))
      if (!user || !matches) throw new UnauthorizedError('Wrong email or password')

      const at = now()
      const token = newSessionToken()
      const expiresAt = new Date(at.getTime() + SESSION_TTL_MS)
      await repository.deleteExpiredSessions(user.id, at)
      await repository.createSession({
        tokenHash: hashSessionToken(token),
        userId: user.id,
        expiresAt,
      })

      return {
        token,
        expiresAt,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      }
    },

    /** Who a session token belongs to, or null for no token, an unknown one or an expired one. */
    async authenticate(token: string | undefined) {
      if (!token) return null
      return (await repository.findSessionUser(hashSessionToken(token), now())) ?? null
    },

    async logout(token: string | undefined) {
      if (token) await repository.deleteSession(hashSessionToken(token))
    },
  }
}

export type AuthService = ReturnType<typeof createAuthService>
