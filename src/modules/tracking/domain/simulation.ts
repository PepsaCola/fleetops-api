import { along } from '@turf/along'
import { bearing } from '@turf/bearing'
import { distance } from '@turf/distance'
import { lineString } from '@turf/helpers'
import { length } from '@turf/length'

// The demo fleet has no trackers, so positions are worked out from the clock instead: every
// active vehicle drives a fixed route out to a customer and back, over and over. The same time
// always gives the same positions, so every server instance agrees without sharing any state.

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

/** Positions repeat from here on; any fixed moment works */
export const SIMULATION_EPOCH = Date.UTC(2026, 0, 1)

const SPEED_KMH: Record<RouteKind, number> = { local: 40, regional: 70 }
const ROUTE_KIND: Record<SimulatedVehicle['type'], RouteKind> = {
  truck: 'regional',
  van: 'local',
  car: 'local',
}
const MINUTE = 60_000
const STOP_AT_CUSTOMER = 20 * MINUTE
const STOP_AT_DEPOT = 40 * MINUTE
/** A route belongs to the depot it starts this close to (routing snaps the start to a road) */
const DEPOT_RADIUS_KM = 3
/** How far ahead to look when working out the direction of travel */
const HEADING_LOOKAHEAD_KM = 0.05

export function prepareRoute(route: DemoRoute) {
  const line = lineString(route.path)
  const lengthKm = length(line)
  // Whole milliseconds keep the cycle exact, so positions repeat to the last digit
  const driveMs = Math.round((lengthKm / SPEED_KMH[route.kind]) * 60 * MINUTE)
  return {
    ...route,
    line,
    lengthKm,
    driveMs,
    cycleMs: 2 * driveMs + STOP_AT_CUSTOMER + STOP_AT_DEPOT,
  }
}

export type PreparedRoute = ReturnType<typeof prepareRoute>

const modulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor

/** FNV-1a: a cheap, stable hash, so a vehicle keeps its route and place across requests */
function hash(text: string) {
  let value = 0x811c9dc5
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 0x01000193)
  return value >>> 0
}

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

/** Where a vehicle on `route` is at `now`; `offsetMs` spreads vehicles sharing a route along it. */
export function positionOnRoute(route: PreparedRoute, offsetMs: number, now: number) {
  // One cycle: drive out, stop at the customer, drive back, stop at the depot
  let t = modulo(now - SIMULATION_EPOCH + offsetMs, route.cycleMs)
  if (t < route.driveMs) {
    const km = (t / route.driveMs) * route.lengthKm
    return { ...travelling(route, km, true), activity: 'to_customer', routeId: route.id } as const
  }
  t -= route.driveMs
  if (t < STOP_AT_CUSTOMER) return standing(pointAt(route, route.lengthKm), 'at_customer', route.id)
  t -= STOP_AT_CUSTOMER
  if (t < route.driveMs) {
    const km = route.lengthKm - (t / route.driveMs) * route.lengthKm
    return { ...travelling(route, km, false), activity: 'to_depot', routeId: route.id } as const
  }
  return standing(pointAt(route, 0), 'at_depot', route.id)
}

/** The route a vehicle drives: one of the routes of its kind that start at its home depot. */
export function routeFor(vehicle: SimulatedVehicle, routes: PreparedRoute[]) {
  const { lng, lat } = vehicle.homeDepot.location
  const candidates = routes.filter(
    (route) =>
      route.kind === ROUTE_KIND[vehicle.type] &&
      route.path[0] !== undefined &&
      distance(route.path[0], [lng, lat]) <= DEPOT_RADIUS_KM,
  )
  return candidates[hash(vehicle.id) % candidates.length]
}

/** Where the vehicle is at `now`: on its route when active, otherwise parked at its depot. */
export function simulateVehicle(
  vehicle: SimulatedVehicle,
  routes: PreparedRoute[],
  now: number,
): SimulatedPosition {
  const { lng, lat } = vehicle.homeDepot.location
  if (vehicle.status !== 'active') return standing([lng, lat], 'off_duty', null)

  const route = routeFor(vehicle, routes)
  if (!route) return standing([lng, lat], 'at_depot', null)
  return positionOnRoute(route, hash(vehicle.id) % route.cycleMs, now)
}
