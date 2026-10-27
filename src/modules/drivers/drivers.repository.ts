import { and, asc, count, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'

import type { Db } from '../../infra/db/client.ts'
import { containing } from '../../infra/db/like.ts'
import { pageOffset, parseSort } from '../../shared/http/pagination.ts'
import { depots } from '../depots/depots.table.ts'
import type { ExpiryRange } from './domain/documents.ts'
import type { DriverListQuery } from './drivers.schemas.ts'
import { drivers } from './drivers.table.ts'

const driverFields = {
  id: drivers.id,
  firstName: drivers.firstName,
  lastName: drivers.lastName,
  phone: drivers.phone,
  licenseNumber: drivers.licenseNumber,
  licenseCategories: drivers.licenseCategories,
  licenseExpiresOn: drivers.licenseExpiresOn,
  medicalExpiresOn: drivers.medicalExpiresOn,
  status: drivers.status,
  homeDepot: { id: depots.id, name: depots.name },
}

/** The day the first document expires: what the documents filter and sort work on */
const documentsExpireOn = sql`least(${drivers.licenseExpiresOn}, ${drivers.medicalExpiresOn})`

const SORT_COLUMNS = {
  lastName: drivers.lastName,
  documentsExpireOn,
}

function searchFilter(search: string) {
  const name = containing(search)
  // Phones are stored as +380671234567; people type them with spaces, dashes or brackets
  const digits = search.replace(/[\s()+-]/g, '')
  return or(
    ilike(sql`${drivers.firstName} || ' ' || ${drivers.lastName}`, name),
    ilike(sql`${drivers.lastName} || ' ' || ${drivers.firstName}`, name),
    digits ? ilike(drivers.phone, containing(digits)) : undefined,
    ilike(drivers.licenseNumber, containing(search.replaceAll(' ', ''))),
  )
}

function listFilter(query: DriverListQuery, expiry: ExpiryRange | undefined) {
  return and(
    query.status ? eq(drivers.status, query.status) : undefined,
    query.depotId ? eq(drivers.homeDepotId, query.depotId) : undefined,
    query.search ? searchFilter(query.search) : undefined,
    expiry?.from ? gte(documentsExpireOn, expiry.from) : undefined,
    expiry?.to ? lte(documentsExpireOn, expiry.to) : undefined,
  )
}

export function createDriversRepository(db: Db) {
  return {
    /** `expiry` keeps only drivers whose first document expires within that range */
    async list(query: DriverListQuery, expiry?: ExpiryRange) {
      const where = listFilter(query, expiry)
      const { field, descending } = parseSort(query.sort)
      const sortColumn = SORT_COLUMNS[field]

      const [items, totals] = await Promise.all([
        db
          .select(driverFields)
          .from(drivers)
          .innerJoin(depots, eq(depots.id, drivers.homeDepotId))
          .where(where)
          // The id breaks ties, so rows sharing a value (e.g. a surname) keep their place across pages
          .orderBy(descending ? desc(sortColumn) : asc(sortColumn), asc(drivers.id))
          .limit(query.pageSize)
          .offset(pageOffset(query)),
        db.select({ total: count() }).from(drivers).where(where),
      ])

      return { items, total: totals[0]?.total ?? 0 }
    },

    async findById(id: string) {
      const [driver] = await db
        .select(driverFields)
        .from(drivers)
        .innerJoin(depots, eq(depots.id, drivers.homeDepotId))
        .where(eq(drivers.id, id))
      return driver
    },
  }
}

export type DriversRepository = ReturnType<typeof createDriversRepository>

/** A driver as stored, before the documents state is worked out */
export type DriverRow = NonNullable<Awaited<ReturnType<DriversRepository['findById']>>>
