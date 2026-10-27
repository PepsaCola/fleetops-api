import { describe, expect, it } from 'vitest'

import { NotFoundError } from '../../shared/errors.ts'
import type { VehiclesRepository } from './vehicles.repository.ts'
import { VehicleListQuerySchema } from './vehicles.schemas.ts'
import { createVehiclesService } from './vehicles.service.ts'

const repositoryWith = (overrides: Partial<VehiclesRepository>) =>
  ({
    list: async () => ({ items: [], total: 0 }),
    findById: async () => undefined,
    listWithDepots: async () => [],
    ...overrides,
  }) as VehiclesRepository

describe('vehicles service', () => {
  it('returns the page that was asked for, with the total', async () => {
    const service = createVehiclesService({
      repository: repositoryWith({ list: async () => ({ items: [], total: 57 }) }),
    })

    const page = await service.list(VehicleListQuerySchema.parse({ page: 3, pageSize: 25 }))

    expect(page).toEqual({ items: [], total: 57, page: 3, pageSize: 25 })
  })

  it('reports a missing vehicle as NotFoundError', async () => {
    const service = createVehiclesService({ repository: repositoryWith({}) })

    await expect(service.get('0199d2a4-5f3e-7c11-9a2b-3c4d5e6f7a8b')).rejects.toBeInstanceOf(
      NotFoundError,
    )
  })
})
