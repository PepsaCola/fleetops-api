import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm'

import type { Db } from '../../infra/db/client.ts'
import { pageOffset, parseSort } from '../../shared/http/pagination.ts'
import { depots } from '../depots/depots.table.ts'
import type { VehicleListQuery } from './vehicles.schemas.ts'
import { vehicles } from './vehicles.table.ts'

const vehicleFields = {
  id: vehicles.id,
  plate: vehicles.plate,
  make: vehicles.make,
  model: vehicles.model,
  year: vehicles.year,
  type: vehicles.type,
  status: vehicles.status,
  capacityKg: vehicles.capacityKg,
  fuelTankL: vehicles.fuelTankL,
  odometerKm: vehicles.odometerKm,
  homeDepot: { id: depots.id, name: depots.name },
}

const SORT_COLUMNS = {
  plate: vehicles.plate,
  year: vehicles.year,
  odometerKm: vehicles.odometerKm,
  capacityKg: vehicles.capacityKg,
}

/** Escapes LIKE wildcards, so searching for "%" finds a percent sign instead of everything. */
const contains = (text: string) => `%${text.replace(/[\\%_]/g, '\\$&')}%`

function searchFilter(search: string) {
  return or(
    // People type plates without spaces: "aa1234" should still find "AA 1234 KB"
    ilike(sql`replace(${vehicles.plate}, ' ', '')`, contains(search.replaceAll(' ', ''))),
    ilike(vehicles.make, contains(search)),
    ilike(vehicles.model, contains(search)),
  )
}

function listFilter(query: VehicleListQuery) {
  return and(
    query.status ? eq(vehicles.status, query.status) : undefined,
    query.type ? eq(vehicles.type, query.type) : undefined,
    query.depotId ? eq(vehicles.homeDepotId, query.depotId) : undefined,
    query.search ? searchFilter(query.search) : undefined,
  )
}

export function createVehiclesRepository(db: Db) {
  return {
    async list(query: VehicleListQuery) {
      const where = listFilter(query)
      const { field, descending } = parseSort(query.sort)
      const sortColumn = SORT_COLUMNS[field]

      const [items, totals] = await Promise.all([
        db
          .select(vehicleFields)
          .from(vehicles)
          .innerJoin(depots, eq(depots.id, vehicles.homeDepotId))
          .where(where)
          // The id breaks ties, so rows sharing a value (e.g. a year) keep their place across pages
          .orderBy(descending ? desc(sortColumn) : asc(sortColumn), asc(vehicles.id))
          .limit(query.pageSize)
          .offset(pageOffset(query)),
        db.select({ total: count() }).from(vehicles).where(where),
      ])

      return { items, total: totals[0]?.total ?? 0 }
    },

    async findById(id: string) {
      const [vehicle] = await db
        .select(vehicleFields)
        .from(vehicles)
        .innerJoin(depots, eq(depots.id, vehicles.homeDepotId))
        .where(eq(vehicles.id, id))
      return vehicle
    },
  }
}

export type VehiclesRepository = ReturnType<typeof createVehiclesRepository>
