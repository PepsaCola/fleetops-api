import { NotFoundError } from '../../shared/errors.ts'
import { fleetToday } from '../../shared/time/fleet-time.ts'
import { documentState, documentsExpireOn, expiryRange } from './domain/documents.ts'
import type { DriverRow, DriversRepository } from './drivers.repository.ts'
import type { Driver, DriverListQuery, DriverPage } from './drivers.schemas.ts'

type Dependencies = {
  repository: DriversRepository
  /** The current time; tests pass a fixed one */
  now?: () => Date
}

export function createDriversService({ repository, now = () => new Date() }: Dependencies) {
  const withDocuments =
    (today: string) =>
    (driver: DriverRow): Driver => {
      const expiresOn = documentsExpireOn(driver)
      return { ...driver, documentsExpireOn: expiresOn, documents: documentState(expiresOn, today) }
    }

  return {
    async list(query: DriverListQuery): Promise<DriverPage> {
      const today = fleetToday(now())
      const expiry = query.documents ? expiryRange(query.documents, today) : undefined
      const { items, total } = await repository.list(query, expiry)
      return {
        items: items.map(withDocuments(today)),
        total,
        page: query.page,
        pageSize: query.pageSize,
      }
    },

    async get(id: string): Promise<Driver> {
      const driver = await repository.findById(id)
      if (!driver) throw new NotFoundError('Driver', id)
      return withDocuments(fleetToday(now()))(driver)
    },

    /** Every driver with what decides whether they can be sent on a trip; trips plan days from it */
    listForPlanning: () => repository.listForPlanning(),
  }
}

export type DriversService = ReturnType<typeof createDriversService>
