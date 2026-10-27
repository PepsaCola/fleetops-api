import { DEMO_ROUTES } from './domain/demo-routes.gen.ts'
import {
  DEPOT_WAIT_MS,
  prepareRoute,
  simulateVehicle,
  type DemoRoute,
  type SimulatedTrip,
  type SimulatedVehicle,
} from './domain/simulation.ts'
import type { FleetPositions, TrackingRoutes } from './tracking.schemas.ts'

/** A vehicle as the tracking module needs it; the vehicles module supplies them */
export type TrackedVehicle = SimulatedVehicle & { plate: string }
/** A trip as the tracking module needs it; the trips module supplies them */
export type TrackedTrip = SimulatedTrip & { vehicleId: string }

type Dependencies = {
  listVehicles: () => Promise<TrackedVehicle[]>
  /** Trips that aren't cancelled and overlap the span from `from` to `to` */
  listTrips: (from: Date, to: Date) => Promise<TrackedTrip[]>
  routes?: DemoRoute[]
  /** The current time in ms; tests pass a fixed one */
  now?: () => number
}

/** About 10 cm: plenty for a map, and a smaller response */
const roundCoordinate = (value: number) => Math.round(value * 1e6) / 1e6

export function createTrackingService({
  listVehicles,
  listTrips,
  routes = DEMO_ROUTES,
  now = Date.now,
}: Dependencies) {
  const prepared = new Map(routes.map((route) => [route.id, prepareRoute(route)]))

  return {
    async positions(): Promise<FleetPositions> {
      const at = now()
      // Trips either side of now tell who is driving, who is about to, and who just got back
      const [vehicles, trips] = await Promise.all([
        listVehicles(),
        listTrips(new Date(at - DEPOT_WAIT_MS), new Date(at + DEPOT_WAIT_MS)),
      ])
      const tripsOf = Map.groupBy(trips, (trip) => trip.vehicleId)

      return {
        at: new Date(at).toISOString(),
        vehicles: vehicles.map((vehicle) => {
          const position = simulateVehicle(vehicle, tripsOf.get(vehicle.id) ?? [], prepared, at)
          return {
            vehicleId: vehicle.id,
            plate: vehicle.plate,
            type: vehicle.type,
            ...position,
            lng: roundCoordinate(position.lng),
            lat: roundCoordinate(position.lat),
            headingDeg: position.headingDeg === null ? null : Math.round(position.headingDeg),
          }
        }),
      }
    },

    routes(): TrackingRoutes {
      return { routes: routes.map(({ id, name, kind, path }) => ({ id, name, kind, path })) }
    },
  }
}

export type TrackingService = ReturnType<typeof createTrackingService>
