import { fleetToday, type IsoDate } from '../../../shared/time/fleet-time.ts'
import { tripFuel, type VehicleType } from './fuel.ts'

export type CostVehicle = { id: string; plate: string; type: VehicleType }
export type CostRoute = { id: string; lengthKm: number }
export type CostTrip = { vehicleId: string; routeId: string; departsAt: Date; returnsAt: Date }
export type CostWorkOrder = { vehicle: { id: string }; startsAt: string; costUah: number }

type Tally = { km: number; fuelUah: number; maintenanceUah: number }

const emptyTally = (): Tally => ({ km: 0, fuelUah: 0, maintenanceUah: 0 })
const spent = (tally: Tally) => tally.fuelUah + tally.maintenanceUah

type Records = {
  days: IsoDate[]
  vehicles: CostVehicle[]
  trips: CostTrip[]
  workOrders: CostWorkOrder[]
  routes: CostRoute[]
  now: Date
}

/**
 * What the fleet spent over some days, day by day and vehicle by vehicle: fuel for every trip
 * that's back by `now`, and every work order done. A cost belongs to the day it started, Kyiv
 * time; one that started outside the days isn't counted.
 */
export function costReport({ days, vehicles, trips, workOrders, routes, now }: Records) {
  const byDay = new Map(days.map((day) => [day, emptyTally()]))
  const byVehicle = new Map(vehicles.map((vehicle) => [vehicle.id, emptyTally()]))

  const add = (startedAt: Date, vehicleId: string, cost: Tally) => {
    const day = byDay.get(fleetToday(startedAt))
    if (!day) return
    for (const tally of [day, byVehicle.get(vehicleId)]) {
      if (!tally) continue
      tally.km += cost.km
      tally.fuelUah += cost.fuelUah
      tally.maintenanceUah += cost.maintenanceUah
    }
  }

  const routeById = new Map(routes.map((route) => [route.id, route]))
  const typeOf = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.type]))
  for (const trip of trips) {
    const route = routeById.get(trip.routeId)
    const type = typeOf.get(trip.vehicleId)
    // A trip still on the road hasn't burnt all its fuel yet: it counts once it's back
    if (!route || !type || trip.returnsAt > now) continue
    const fuel = tripFuel(route.lengthKm, type)
    add(trip.departsAt, trip.vehicleId, { km: fuel.km, fuelUah: fuel.uah, maintenanceUah: 0 })
  }
  for (const order of workOrders) {
    add(new Date(order.startsAt), order.vehicle.id, {
      km: 0,
      fuelUah: 0,
      maintenanceUah: order.costUah,
    })
  }

  const totals = emptyTally()
  for (const tally of byDay.values()) {
    totals.km += tally.km
    totals.fuelUah += tally.fuelUah
    totals.maintenanceUah += tally.maintenanceUah
  }
  const rounded = (tally: Tally) => ({ ...tally, km: Math.round(tally.km) })

  return {
    totals: rounded(totals),
    days: days.map((day) => {
      const { fuelUah, maintenanceUah } = byDay.get(day) ?? emptyTally()
      return { day, fuelUah, maintenanceUah }
    }),
    // The vehicles that cost anything, the dearest first
    vehicles: vehicles
      .map(({ id, plate, type }) => ({
        vehicle: { id, plate, type },
        ...rounded(byVehicle.get(id) ?? emptyTally()),
      }))
      .filter((row) => spent(row) > 0)
      .toSorted((a, b) => spent(b) - spent(a)),
  }
}
