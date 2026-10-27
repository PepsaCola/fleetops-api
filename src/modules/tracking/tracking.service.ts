import { DEMO_ROUTES } from './domain/demo-routes.gen.ts'
import {
  prepareRoute,
  simulateVehicle,
  type DemoRoute,
  type SimulatedVehicle,
} from './domain/simulation.ts'
import type { FleetPositions, TrackingRoutes } from './tracking.schemas.ts'

/** A vehicle as the tracking module needs it; the vehicles module supplies them */
export type TrackedVehicle = SimulatedVehicle & { plate: string }

type Dependencies = {
  listVehicles: () => Promise<TrackedVehicle[]>
  routes?: DemoRoute[]
  /** The current time in ms; tests pass a fixed one */
  now?: () => number
}

/** About 10 cm: plenty for a map, and a smaller response */
const roundCoordinate = (value: number) => Math.round(value * 1e6) / 1e6

export function createTrackingService({
  listVehicles,
  routes = DEMO_ROUTES,
  now = Date.now,
}: Dependencies) {
  const prepared = routes.map(prepareRoute)

  return {
    async positions(): Promise<FleetPositions> {
      const at = now()
      const vehicles = await listVehicles()

      return {
        at: new Date(at).toISOString(),
        vehicles: vehicles.map((vehicle) => {
          const position = simulateVehicle(vehicle, prepared, at)
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
