import { UnprocessableError } from '../../shared/errors.ts'
import { addDays, daysFrom, type IsoDate } from '../../shared/time/fleet-time.ts'
import { DEMO_ROUTES, prepareRoute, type DemoRoute } from '../tracking/index.ts'
import type { CostQuery, CostReport } from './costs.schemas.ts'
import { DIESEL_UAH_PER_LITRE } from './domain/fuel.ts'
import { costReport, type CostTrip, type CostVehicle, type CostWorkOrder } from './domain/report.ts'

type Dependencies = {
  /** The vehicles module supplies the fleet */
  listVehicles: () => Promise<CostVehicle[]>
  /** The trips module: trips still on that leave on those days, the days planned first */
  listTrips: (first: IsoDate, last: IsoDate) => Promise<CostTrip[]>
  /** The maintenance module: work orders done that touch those days */
  listWorkOrders: (first: IsoDate, last: IsoDate) => Promise<CostWorkOrder[]>
  routes?: DemoRoute[]
  /** The current time; tests pass a fixed one */
  now?: () => Date
}

/** A report covers this many days at most */
const LONGEST_REPORT_DAYS = 62

export function createCostsService({
  listVehicles,
  listTrips,
  listWorkOrders,
  routes = DEMO_ROUTES,
  now = () => new Date(),
}: Dependencies) {
  const prepared = routes.map(prepareRoute)

  return {
    /** What the fleet spent on fuel and in the workshop over some days. */
    async report({ from, to }: CostQuery): Promise<CostReport> {
      if (to < from || to > addDays(from, LONGEST_REPORT_DAYS - 1)) {
        throw new UnprocessableError(
          'RANGE_TOO_LONG',
          `A report covers 1 to ${LONGEST_REPORT_DAYS} days, with "to" on or after "from"`,
        )
      }

      const [vehicles, trips, workOrders] = await Promise.all([
        listVehicles(),
        listTrips(from, to),
        listWorkOrders(from, to),
      ])
      const report = costReport({
        days: daysFrom(from, to),
        vehicles,
        trips,
        workOrders,
        routes: prepared,
        now: now(),
      })
      return { from, to, dieselUahPerLitre: DIESEL_UAH_PER_LITRE, ...report }
    },
  }
}

export type CostsService = ReturnType<typeof createCostsService>
