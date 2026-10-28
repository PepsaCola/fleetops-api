import { index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { id, timestamps } from '../../infra/db/columns.ts'

/** Dispatchers plan and change trips; viewers see everything and change nothing */
export const userRole = pgEnum('user_role', ['dispatcher', 'viewer'])

export const users = pgTable('users', {
  id: id(),
  /** Kept in lower case, so signing in doesn't depend on how it was typed */
  email: text().notNull().unique(),
  name: text().notNull(),
  role: userRole().notNull(),
  /** An scrypt hash with its salt and parameters; see domain/password.ts */
  passwordHash: text().notNull(),
  ...timestamps,
})

export const sessions = pgTable(
  'sessions',
  {
    /** SHA-256 of the token in the browser's cookie; the token itself is never stored */
    tokenHash: text().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.userId)],
)
