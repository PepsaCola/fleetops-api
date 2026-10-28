/** Postgres's code for a write an exclusion constraint refused */
const EXCLUSION_VIOLATION = '23P01'

/** Whether an exclusion constraint refused a write. Drizzle wraps the driver's errors, so the code may sit on the error or on its cause */
export function isExclusionViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  if ('code' in error && error.code === EXCLUSION_VIOLATION) return true
  return 'cause' in error && isExclusionViolation(error.cause)
}

/** Runs a write an exclusion constraint may refuse, and turns that refusal into `refusal()`. */
export async function refusingOverlap<Result>(
  write: PromiseLike<Result>,
  refusal: () => Error,
): Promise<Result> {
  try {
    return await write
  } catch (error) {
    throw isExclusionViolation(error) ? refusal() : error
  }
}
