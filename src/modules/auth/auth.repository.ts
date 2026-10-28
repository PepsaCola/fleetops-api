import { and, eq, gt, lte } from 'drizzle-orm'

import type { Db } from '../../infra/db/client.ts'
import { sessions, users } from './auth.table.ts'

export function createAuthRepository(db: Db) {
  return {
    async findUserByEmail(email: string) {
      const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()))
      return user
    },

    async createSession(session: { tokenHash: string; userId: string; expiresAt: Date }) {
      await db.insert(sessions).values(session)
    },

    /** The user behind a session that exists and hasn't expired at `now` */
    async findSessionUser(tokenHash: string, now: Date) {
      const [user] = await db
        .select({ id: users.id, email: users.email, name: users.name, role: users.role })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
      return user
    },

    async deleteSession(tokenHash: string) {
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash))
    },

    /** Housekeeping on every sign-in: the user's expired sessions go */
    async deleteExpiredSessions(userId: string, now: Date) {
      await db
        .delete(sessions)
        .where(and(eq(sessions.userId, userId), lte(sessions.expiresAt, now)))
    },
  }
}

export type AuthRepository = ReturnType<typeof createAuthRepository>

/** A signed-in user, as every request sees them */
export type SessionUser = NonNullable<Awaited<ReturnType<AuthRepository['findSessionUser']>>>
