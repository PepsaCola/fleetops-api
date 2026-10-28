import { createHash, randomBytes } from 'node:crypto'

/** How long a sign-in lasts */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60_000

/** A new session token: 256 random bits for the browser's cookie */
export const newSessionToken = () => randomBytes(32).toString('base64url')

/** What the database keeps instead of the token, so a leaked sessions table signs nobody in */
export const hashSessionToken = (token: string) =>
  createHash('sha256').update(token).digest('base64url')
