import { STATUS_CODES } from 'node:http'

import type { FastifyReply, FastifyRequest } from 'fastify'
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod'

import { AppError } from '../errors.ts'
import type { ProblemDetails } from './problem.ts'

type ProblemInput = Omit<ProblemDetails, 'type' | 'title' | 'requestId'>

function sendProblem(reply: FastifyReply, problem: ProblemInput) {
  const body: ProblemDetails = {
    type: 'about:blank',
    title: STATUS_CODES[problem.status] ?? 'Error',
    ...problem,
    requestId: reply.request.id,
  }
  return reply.status(problem.status).type('application/problem+json').send(body)
}

/** Errors Fastify raises itself (malformed JSON, payload too large...) carry a 4xx statusCode. */
function isClientError(error: unknown): error is Error & { statusCode: number; code?: string } {
  return (
    error instanceof Error &&
    'statusCode' in error &&
    typeof error.statusCode === 'number' &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  )
}

export function errorHandler(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  if (hasZodFastifySchemaValidationErrors(error)) {
    const errors: Record<string, string[]> = {}
    for (const issue of error.validation) {
      // "/stops/0/address" → "stops.0.address"; a problem with the whole body has no path
      const field = issue.instancePath.slice(1).replaceAll('/', '.') || error.validationContext
      ;(errors[field ?? 'request'] ??= []).push(issue.message ?? 'Invalid value')
    }
    return sendProblem(reply, {
      status: 400,
      code: 'VALIDATION_FAILED',
      detail: 'Some fields are missing or invalid.',
      errors,
    })
  }

  if (error instanceof AppError) {
    return sendProblem(reply, {
      status: error.status,
      code: error.code,
      detail: error.message,
      ...(error.details && { details: error.details }),
    })
  }

  if (isClientError(error) && !isResponseSerializationError(error)) {
    return sendProblem(reply, {
      status: error.statusCode,
      code: error.code ?? 'BAD_REQUEST',
      detail: error.message,
    })
  }

  // Anything else is a bug: log everything, show the client nothing internal
  request.log.error({ err: error }, 'Unhandled error')
  return sendProblem(reply, {
    status: 500,
    code: 'INTERNAL_ERROR',
    detail: 'Something went wrong on our side. Please try again later.',
  })
}

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  return sendProblem(reply, {
    status: 404,
    code: 'ROUTE_NOT_FOUND',
    detail: `${request.method} ${request.url} doesn't exist`,
  })
}
