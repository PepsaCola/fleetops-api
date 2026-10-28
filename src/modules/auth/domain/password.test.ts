import { describe, expect, it } from 'vitest'

import { hashPassword, verifyPassword } from './password.ts'

describe('passwords', () => {
  it('verifies the password it hashed, and nothing else', async () => {
    const stored = await hashPassword('fleetops-demo')

    expect(stored).toMatch(/^scrypt\$16384\$8\$1\$/)
    expect(await verifyPassword('fleetops-demo', stored)).toBe(true)
    expect(await verifyPassword('fleetops-dem0', stored)).toBe(false)
  })

  it('salts every hash, so equal passwords look different', async () => {
    expect(await hashPassword('same password')).not.toBe(await hashPassword('same password'))
  })

  it('refuses a hash it doesn’t understand', async () => {
    expect(await verifyPassword('anything', 'md5$5f4dcc3b')).toBe(false)
  })
})
