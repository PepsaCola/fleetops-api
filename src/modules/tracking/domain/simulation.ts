import { along } from '@turf/along'
import { bearing } from '@turf/bearing'
import { distance } from '@turf/distance'
import { lineString } from '@turf/helpers'
import { length } from '@turf/length'

// The demo fleet has no trackers, so positions are worked out from each vehicle's trips and the
// clock: on a trip a vehicle is somewhere along its route, and between trips it waits at its
// depot. The same trips at the same moment always give the same positions, so every server
// instance agrees without sharing any state.

export const ROUTE_KINDS = ['local', 'regional'] as const
export type RouteKind = (typeof ROUTE_KINDS)[number]
type LngLat = [lng: number, lat: number]

export type DemoRoute = {
  id: string
  name: string
  /** Local drops for vans and cars, regional runs for trucks */
  kind: RouteKind
  /** Road geometry from the depot to the customer */
  path: LngLat[]
}

export const ACTIVITIES = [
  'to_customer',
  'at_customer',
  'to_depot',
  'at_depot',
  'off_duty',
] as const
export type Activity = (typeof ACTIVITIES)[number]

export type SimulatedPosition = {
  lng: number
  lat: number
  /** Direction of travel in degrees clockwise from north; null while standing */
  headingDeg: number | null
  speedKmh: number
  activity: Activity
  routeId: string | null
}

export type SimulatedVehicle = {
  id: string
  type: 'truck' | 'van' | 'car'
  status: 'active' | 'maintenance' | 'inactive'
  homeDepot: { location: { lng: number; lat: number } }
}

/** A trip as positions need it: which route, and when it leaves and is back */
export type SimulatedTrip = { routeId: string; departsAt: Date; returnsAt: Date }

const SPEED_KMH: Record<RouteKind, number> = { local: 40, regional: 70 }
const ROUTE_KIND: Record<SimulatedVehicle['type'], RouteKind> = {
  truck: 'regional',
  van: 'local',
  car: 'local',
}
const MINUTE = 60_000
const STOP_AT_CUSTOMER = 20 * MINUTE
/** This close to one of its trips a vehicle is at the depot getting ready; further off it is off duty */
export const DEPOT_WAIT_MS = 60 * MINUTE
/** A route belongs to the depot it starts this close to (routing snaps the start to a road) */
const DEPOT_RADIUS_KM = 3
/** How far ahead to look when working out the direction of travel */
const HEADING_LOOKAHEAD_KM = 0.05

export function prepareRoute(route: DemoRoute) {
  const line = lineString(route.path)
  const lengthKm = length(line)
  // Whole milliseconds, so trip times stay exact when they are stored and added up
  const driveMs = Math.round((lengthKm / SPEED_KMH[route.kind]) * 60 * MINUTE)
  return {
    ...route,
    line,
    lengthKm,
    driveMs,
    /** One trip: out to the customer, unloading there, and back to the depot */
    roundTripMs: 2 * driveMs + STOP_AT_CUSTOMER,
  }
}

export type PreparedRoute = ReturnType<typeof prepareRoute>

const modulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor

function pointAt(route: PreparedRoute, km: number): LngLat {
  const clamped = Math.min(Math.max(km, 0), route.lengthKm)
  const [lng = 0, lat = 0] = along(route.line, clamped).geometry.coordinates
  return [lng, lat]
}

function travelling(
  route: PreparedRoute,
  km: number,
  outbound: boolean,
): Omit<SimulatedPosition, 'activity' | 'routeId'> {
  const here = pointAt(route, km)
  // The road just behind and just ahead gives the direction, even at either end of the route
  const behind = pointAt(route, km - HEADING_LOOKAHEAD_KM)
  const ahead = pointAt(route, km + HEADING_LOOKAHEAD_KM)
  const heading = outbound ? bearing(behind, ahead) : bearing(ahead, behind)
  return {
    lng: here[0],
    lat: here[1],
    headingDeg: modulo(heading, 360),
    speedKmh: SPEED_KMH[route.kind],
  }
}

function standing(point: LngLat, activity: Activity, routeId: string | null): SimulatedPosition {
  return { lng: point[0], lat: point[1], headingDeg: null, speedKmh: 0, activity, routeId }
}

/** Where a vehicle is `elapsedMs` into a trip on `route`: driving out, at the customer, or back. */
export function positionOnTrip(route: PreparedRoute, elapsedMs: number): SimulatedPosition {
  if (elapsedMs < route.driveMs) {
    const km = (elapsedMs / route.driveMs) * route.lengthKm
    return { ...travelling(route, km, true), activity: 'to_customer', routeId: route.id }
  }
  const sinceArrival = elapsedMs - route.driveMs
  if (sinceArrival < STOP_AT_CUSTOMER) {
    return standing(pointAt(route, route.lengthKm), 'at_customer', route.id)
  }
  const drivenBack = Math.min(sinceArrival - STOP_AT_CUSTOMER, route.driveMs)
  const km = route.lengthKm - (drivenBack / route.driveMs) * route.lengthKm
  return { ...travelling(route, km, false), activity: 'to_depot', routeId: route.id }
}

/** The routes a vehicle can drive: those of its kind that start at its home depot. */
export function routesFrom(
  vehicle: Pick<SimulatedVehicle, 'type' | 'homeDepot'>,
  routes: PreparedRoute[],
) {
  const { lng, lat } = vehicle.homeDepot.location
  return routes.filter(
    (route) =>
      route.kind === ROUTE_KIND[vehicle.type] &&
      route.path[0] !== undefined &&
      distance(route.path[0], [lng, lat]) <= DEPOT_RADIUS_KM,
  )
}

/**
 * Where the vehicle is at `now`: along the route of the trip it is on, at its depot when one of
 * its trips is near, and off duty otherwise. `trips` are the vehicle's own.
 */
export function simulateVehicle(
  vehicle: SimulatedVehicle,
  trips: SimulatedTrip[],
  routes: ReadonlyMap<string, PreparedRoute>,
  now: number,
): SimulatedPosition {
  const { lng, lat } = vehicle.homeDepot.location
  if (vehicle.status !== 'active') return standing([lng, lat], 'off_duty', null)

  const current = trips.find(
    (trip) => trip.departsAt.getTime() <= now && now < trip.returnsAt.getTime(),
  )
  const currentRoute = current && routes.get(current.routeId)
  if (current && currentRoute)
    return positionOnTrip(currentRoute, now - current.departsAt.getTime())

  // Before and after its trips the vehicle waits in the yard, where its routes start
  const near = trips.find(
    (trip) =>
      trip.departsAt.getTime() - DEPOT_WAIT_MS <= now &&
      now < trip.returnsAt.getTime() + DEPOT_WAIT_MS,
  )
  const nearRoute = near && routes.get(near.routeId)
  if (nearRoute) return standing(pointAt(nearRoute, 0), 'at_depot', null)
  return standing([lng, lat], 'off_duty', null)
}
