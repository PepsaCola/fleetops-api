/**
 * Errors that services throw on purpose. The error handler turns each of them into a
 * Problem Details response with the matching status and machine-readable code.
 */
export abstract class AppError extends Error {
  abstract readonly status: number
  abstract readonly code: string
  readonly details: Record<string, unknown> | undefined

  constructor(message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = new.target.name
    this.details = details
  }
}

export class NotFoundError extends AppError {
  override readonly status = 404
  override readonly code = 'NOT_FOUND'

  constructor(resource: string, id: string) {
    super(`${resource} ${id} was not found`)
  }
}

/** A business rule blocks the request, e.g. TRIP_OVERLAP when a vehicle is already busy. */
export class ConflictError extends AppError {
  override readonly status = 409
  override readonly code: string

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message, details)
    this.code = code
  }
}

/** The request is well-formed but asks for what the rules don't allow, e.g. a truck without a C licence. */
export class UnprocessableError extends AppError {
  override readonly status = 422
  override readonly code: string

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message, details)
    this.code = code
  }
}

export class UnauthorizedError extends AppError {
  override readonly status = 401
  override readonly code = 'UNAUTHORIZED'

  constructor(message = 'Sign in to continue') {
    super(message)
  }
}

export class ForbiddenError extends AppError {
  override readonly status = 403
  override readonly code = 'FORBIDDEN'

  constructor(message = "You don't have permission to do this") {
    super(message)
  }
}

/** A dependency the API needs (e.g. the database) is down; the client may retry later. */
export class ServiceUnavailableError extends AppError {
  override readonly status = 503
  override readonly code = 'SERVICE_UNAVAILABLE'
}
