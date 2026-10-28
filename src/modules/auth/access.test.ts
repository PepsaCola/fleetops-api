import { describe, expect, it } from 'vitest'

import { checkAccess } from './access.ts'

const dispatcher = {
  id: '0199d2a4-0000-7000-8000-000000000001',
  email: 'dispatcher@fleetops.demo',
  name: 'Demo Dispatcher',
  role: 'dispatcher' as const,
}
const viewer = { ...dispatcher, email: 'viewer@fleetops.demo', role: 'viewer' as const }

describe('access', () => {
  it('lets nobody in without signing in', () => {
    expect(() => checkAccess(null, 'GET')).toThrow(expect.objectContaining({ status: 401 }))
  })

  it('lets a viewer read but not change anything', () => {
    expect(checkAccess(viewer, 'GET')).toBe(viewer)
    expect(() => checkAccess(viewer, 'POST')).toThrow(expect.objectContaining({ status: 403 }))
    expect(() => checkAccess(viewer, 'PATCH')).toThrow(expect.objectContaining({ status: 403 }))
  })

  it('lets a dispatcher change things', () => {
    expect(checkAccess(dispatcher, 'POST')).toBe(dispatcher)
    expect(checkAccess(dispatcher, 'PATCH')).toBe(dispatcher)
  })
})
