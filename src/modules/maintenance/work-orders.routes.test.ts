import { describe, expect, it, vi } from 'vitest'

import { createTestServer } from '../../shared/http/test-server.ts'
import { workOrderRoutes } from './work-orders.routes.ts'
import type { WorkOrder } from './work-orders.schemas.ts'
import type { WorkOrdersService } from './work-orders.service.ts'

const order: WorkOrder = {
  id: '0199d2a4-5f3e-7c11-9a2b-3c4d5e6f7a8b',
  number: 5001,
  kind: 'service',
  status: 'scheduled',
  vehicle: { id: '0199d2a4-0000-7000-8000-000000000001', plate: 'AA 1234 KB', type: 'van' },
  startsAt: '2026-10-29T06:00:00.000Z',
  endsAt: '2026-10-29T10:00:00.000Z',
  costUah: 4800,
  note: 'Oil and filters',
  cancelledAt: null,
}

async function serverWith(service: Partial<WorkOrdersService>) {
  const app = createTestServer()
  await app.register(workOrderRoutes, {
    prefix: '/api/v1',
    service: service as WorkOrdersService,
  })
  return app
}

describe('work order routes', () => {
  it('lists the work orders of a range of days', async () => {
    const list = vi.fn<WorkOrdersService['list']>(async () => ({ items: [order] }))
    const app = await serverWith({ list })

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/work-orders?from=2026-10-28&to=2026-11-03&status=scheduled',
    })

    expect(response.statusCode).toBe(200)
    expect(list).toHaveBeenCalledWith({ from: '2026-10-28', to: '2026-11-03', status: 'scheduled' })
    expect(response.json()).toEqual({ items: [order] })
  })

  it('books a work order and answers 201 with it', async () => {
    const create = vi.fn<WorkOrdersService['create']>(async () => order)
    const app = await serverWith({ create })
    const booking = {
      vehicleId: order.vehicle.id,
      kind: 'service',
      startsAt: order.startsAt,
      endsAt: order.endsAt,
      costUah: 4800,
      note: 'Oil and filters',
    }

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/work-orders',
      payload: booking,
    })

    expect(response.statusCode).toBe(201)
    expect(create).toHaveBeenCalledWith(booking)
  })

  it('asks for everything a work order needs', async () => {
    const create = vi.fn<WorkOrdersService['create']>()
    const app = await serverWith({ create })

    const response = await app.inject({ method: 'POST', url: '/api/v1/work-orders', payload: {} })

    expect(response.statusCode).toBe(400)
    expect(Object.keys(response.json().errors).sort()).toEqual([
      'costUah',
      'endsAt',
      'kind',
      'startsAt',
      'vehicleId',
    ])
    expect(create).not.toHaveBeenCalled()
  })
})
