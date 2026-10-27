import { NotFoundError } from '../../shared/errors.ts'
import { addDays, fleetInstant, fleetToday, type IsoDate } from '../../shared/time/fleet-time.ts'
import { DEMO_ROUTES, prepareRoute, type DemoRoute } from '../tracking/index.ts'
import { planDay, type PlanningDriver, type PlanningVehicle } from './domain/timetable.ts'
import { tripStatus } from './domain/trip-status.ts'
import type { TripRow, TripsRepository } from './trips.repository.ts'
import type { Trip, TripListQuery, TripPage } from './trips.schemas.ts'

type Dependencies = {
  repository: TripsRepository
  /** The vehicles and drivers modules supply who could work; days are planned from them */
  listVehicles: () => Promise<PlanningVehicle[]>
  listDrivers: () => Promise<PlanningDriver[]>
  routes?: DemoRoute[]
  /** The current time; tests pass a fixed one */
  now?: () => Date
}

/** Days are planned on demand only this close to today, so a stray request can't fill years */
const PLANNING_WINDOW = { pastDays: 31, futureDays: 14 }

export function createTripsService({
  repository,
  listVehicles,
  listDrivers,
  routes = DEMO_ROUTES,
  now = () => new Date(),
}: Dependencies) {
  const prepared = new Map(routes.map((route) => [route.id, prepareRoute(route)]))

  const toTrip =
    (at: Date) =>
    (row: TripRow): Trip => {
      const route = prepared.get(row.routeId)
      if (!route) throw new Error(`Trip ${row.number} is on an unknown route "${row.routeId}"`)
      return {
        id: row.id,
        number: row.number,
        status: tripStatus(row, at),
        vehicle: row.vehicle,
        driver: row.driver,
        route: { id: route.id, name: route.name, kind: route.kind },
        departsAt: row.departsAt.toISOString(),
        arrivesAt: new Date(row.departsAt.getTime() + route.driveMs).toISOString(),
        returnsAt: row.returnsAt.toISOString(),
        cancelledAt: row.cancelledAt?.toISOString() ?? null,
      }
    }

  /** Makes sure the day's usual timetable is in place before anyone looks at the day. */
  async function ensurePlanned(day: IsoDate) {
    const today = fleetToday(now())
    const tooFar =
      day < addDays(today, -PLANNING_WINDOW.pastDays) ||
      day > addDays(today, PLANNING_WINDOW.futureDays)
    if (tooFar || (await repository.isPlanned(day))) return

    const [vehicles, drivers] = await Promise.all([listVehicles(), listDrivers()])
    const planned = planDay(day, { vehicles, drivers, routes: [...prepared.values()] })
    await repository.addPlannedDay(day, planned)
  }

  return {
    ensurePlanned,

    async list(query: TripListQuery): Promise<TripPage> {
      const at = now()
      const day = query.day ?? fleetToday(at)
      // The day before first: its late truck shifts run on into this one
      await ensurePlanned(addDays(day, -1))
      await ensurePlanned(day)

      const departing = { from: fleetInstant(day, 0), to: fleetInstant(addDays(day, 1), 0) }
      const { items, total } = await repository.list(query, departing, at)
      return { items: items.map(toTrip(at)), total, page: query.page, pageSize: query.pageSize }
    },

    async get(id: string): Promise<Trip> {
      const trip = await repository.findById(id)
      if (!trip) throw new NotFoundError('Trip', id)
      return toTrip(now())(trip)
    },

    /** Trips still on that overlap the span, the days around it planned first; the map places vehicles from them */
    async listOverlapping(from: Date, to: Date) {
      const days = new Set([addDays(fleetToday(from), -1), fleetToday(from), fleetToday(to)])
      await Promise.all([...days].map((day) => ensurePlanned(day)))
      return repository.listOverlapping(from, to)
    },
  }
}

export type TripsService = ReturnType<typeof createTripsService>
