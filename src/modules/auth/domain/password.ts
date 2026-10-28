import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

// Passwords are stored as scrypt hashes: slow to compute on purpose, salted per user, and with
// their cost alongside, so the cost can go up later without breaking the hashes already stored.
// Format: scrypt$<N>$<r>$<p>$<salt>$<hash>, the salt and the hash in base64url.

const COST = { N: 16_384, r: 8, p: 1 }
const KEY_LENGTH = 32

function derive(password: string, salt: Buffer, cost: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, cost, (error, key) => (error ? reject(error) : resolve(key)))
  })
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const key = await derive(password, salt, COST)
  return [
    'scrypt',
    COST.N,
    COST.r,
    COST.p,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$')
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, N, r, p, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false

  const expected = Buffer.from(hash, 'base64url')
  const key = await derive(password, Buffer.from(salt, 'base64url'), {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  })
  // A constant-time comparison doesn't tell a guesser how much of the guess was right
  return key.length === expected.length && timingSafeEqual(key, expected)
}
