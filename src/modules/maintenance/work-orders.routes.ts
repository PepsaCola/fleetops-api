import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

import {
  WorkOrderCreateSchema,
  WorkOrderListQuerySchema,
  WorkOrderListSchema,
  WorkOrderParamsSchema,
  WorkOrderSchema,
  WorkOrderUpdateSchema,
} from './work-orders.schemas.ts'
import type { WorkOrdersService } from './work-orders.service.ts'

export type WorkOrderRoutesOptions = { service: WorkOrdersService }

export const workOrderRoutes: FastifyPluginAsyncZod<WorkOrderRoutesOptions> = async (
  app,
  { service },
) => {
  app.get(
    '/work-orders',
    {
      schema: {
        tags: ['maintenance'],
        operationId: 'listWorkOrders',
        summary: 'Work orders touching a range of days',
        querystring: WorkOrderListQuerySchema,
        response: { 200: WorkOrderListSchema },
      },
    },
    (request) => service.list(request.query),
  )

  app.post(
    '/work-orders',
    {
      schema: {
        tags: ['maintenance'],
        operationId: 'createWorkOrder',
        summary: 'Book a vehicle into the workshop; 409 when it is on a trip or booked in then',
        body: WorkOrderCreateSchema,
        response: { 201: WorkOrderSchema },
      },
    },
    async (request, reply) => reply.code(201).send(await service.create(request.body)),
  )

  app.get(
    '/work-orders/:workOrderId',
    {
      schema: {
        tags: ['maintenance'],
        operationId: 'getWorkOrder',
        summary: 'Get one work order',
        params: WorkOrderParamsSchema,
        response: { 200: WorkOrderSchema },
      },
    },
    (request) => service.get(request.params.workOrderId),
  )

  app.patch(
    '/work-orders/:workOrderId',
    {
      schema: {
        tags: ['maintenance'],
        operationId: 'updateWorkOrder',
        summary: 'Change a scheduled work order',
        params: WorkOrderParamsSchema,
        body: WorkOrderUpdateSchema,
        response: { 200: WorkOrderSchema },
      },
    },
    (request) => service.update(request.params.workOrderId, request.body),
  )

  app.post(
    '/work-orders/:workOrderId/cancel',
    {
      schema: {
        tags: ['maintenance'],
        operationId: 'cancelWorkOrder',
        summary: 'Cancel a scheduled work order; it stays on record and frees the vehicle',
        params: WorkOrderParamsSchema,
        response: { 200: WorkOrderSchema },
      },
    },
    (request) => service.cancel(request.params.workOrderId),
  )
}
