import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { AuthRepository } from './auth.repository.ts'
import { createAuthService } from './auth.service.ts'
import { hashPassword } from './domain/password.ts'
import { hashSessionToken } from './domain/session-token.ts'

const NOW = new Date('2026-10-28T10:00:00Z')
const PASSWORD = 'fleetops-demo'
const user = {
  id: '0199d2a4-0000-7000-8000-000000000001',
  email: 'dispatcher@fleetops.demo',
  name: 'Demo Dispatcher',
  role: 'dispatcher' as const,
}

let passwordHash: string
beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD)
})

function fakeRepository(overrides: Partial<AuthRepository> = {}): AuthRepository {
  return {
    findUserByEmail: vi.fn<AuthRepository['findUserByEmail']>(async (email) =>
      email === user.email ? { ...user, passwordHash, createdAt: NOW, updatedAt: NOW } : undefined,
    ),
    createSession: vi.fn<AuthRepository['createSession']>(async () => undefined),
    findSessionUser: vi.fn<AuthRepository['findSessionUser']>(async () => user),
    deleteSession: vi.fn<AuthRepository['deleteSession']>(async () => undefined),
    deleteExpiredSessions: vi.fn<AuthRepository['deleteExpiredSessions']>(async () => undefined),
    ...overrides,
  }
}

describe('auth service', () => {
  it('signs in with the right password, storing only a hash of the session token', async () => {
    const repository = fakeRepository()

    const session = await createAuthService({ repository, now: () => NOW }).login(
      user.email,
      PASSWORD,
    )

    expect(session.user).toEqual(user)
    expect(session.expiresAt).toEqual(new Date('2026-11-04T10:00:00Z'))
    expect(repository.createSession).toHaveBeenCalledWith({
      tokenHash: hashSessionToken(session.token),
      userId: user.id,
      expiresAt: session.expiresAt,
    })
    expect(hashSessionToken(session.token)).not.toBe(session.token)
  })

  it('refuses a wrong password and an unknown email alike', async () => {
    const repository = fakeRepository()
    const service = createAuthService({ repository, now: () => NOW })

    await expect(service.login(user.email, 'guess')).rejects.toMatchObject({ status: 401 })
    await expect(service.login('nobody@fleetops.demo', PASSWORD)).rejects.toMatchObject({
      status: 401,
      message: 'Wrong email or password',
    })
    expect(repository.createSession).not.toHaveBeenCalled()
  })

  it('finds the user behind a session token, and nobody without one', async () => {
    const repository = fakeRepository()
    const service = createAuthService({ repository, now: () => NOW })

    expect(await service.authenticate(undefined)).toBeNull()
    expect(repository.findSessionUser).not.toHaveBeenCalled()

    expect(await service.authenticate('token-1')).toEqual(user)
    expect(repository.findSessionUser).toHaveBeenCalledWith(hashSessionToken('token-1'), NOW)
  })
})
