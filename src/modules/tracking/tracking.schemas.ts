import { z } from 'zod'

import { vehicleType } from '../vehicles/vehicles.table.ts'
import { ACTIVITIES, ROUTE_KINDS } from './domain/simulation.ts'

export const VehiclePositionSchema = z
  .object({
    vehicleId: z.uuid(),
    plate: z.string(),
    type: z.enum(vehicleType.enumValues),
    lng: z.number(),
    lat: z.number(),
    headingDeg: z
      .number()
      .nullable()
      .describe('Direction of travel, degrees clockwise from north; null while standing'),
    speedKmh: z.number(),
    activity: z.enum(ACTIVITIES),
    routeId: z.string().nullable().describe('The route the vehicle drives; null when off duty'),
  })
  .meta({ id: 'VehiclePosition' })

export type VehiclePosition = z.infer<typeof VehiclePositionSchema>

export const FleetPositionsSchema = z
  .object({
    at: z.iso.datetime().describe('The moment the positions are for'),
    vehicles: z.array(VehiclePositionSchema),
  })
  .meta({ id: 'FleetPositions' })

export type FleetPositions = z.infer<typeof FleetPositionsSchema>

export const TrackingRouteSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(ROUTE_KINDS),
    path: z.array(z.tuple([z.number(), z.number()])).describe('[lng, lat] from depot to customer'),
  })
  .meta({ id: 'TrackingRoute' })

export const TrackingRoutesSchema = z
  .object({ routes: z.array(TrackingRouteSchema) })
  .meta({ id: 'TrackingRoutes' })

export type TrackingRoutes = z.infer<typeof TrackingRoutesSchema>
