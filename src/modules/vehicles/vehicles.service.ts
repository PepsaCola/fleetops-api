import { NotFoundError } from '../../shared/errors.ts'
import type { VehiclesRepository } from './vehicles.repository.ts'
import type { Vehicle, VehicleListQuery, VehiclePage } from './vehicles.schemas.ts'

export function createVehiclesService({ repository }: { repository: VehiclesRepository }) {
  return {
    async list(query: VehicleListQuery): Promise<VehiclePage> {
      const { items, total } = await repository.list(query)
      return { items, total, page: query.page, pageSize: query.pageSize }
    },

    async get(id: string): Promise<Vehicle> {
      const vehicle = await repository.findById(id)
      if (!vehicle) throw new NotFoundError('Vehicle', id)
      return vehicle
    },
  }
}

export type VehiclesService = ReturnType<typeof createVehiclesService>
