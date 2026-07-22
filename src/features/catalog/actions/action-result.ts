import type { ZodError } from 'zod'

/**
 * One shape for every Server Action result, so the UI renders success and
 * failure the same way everywhere instead of each form inventing its own.
 */
export type ActionState =
  | { status: 'idle' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> }

export const idleState: ActionState = { status: 'idle' }

/** Flattens a Zod error into `{ 'variants.0.sku': 'SKU is required' }`. */
export function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form'
    // First error per field wins; showing five messages on one input is noise.
    if (!errors[key]) errors[key] = issue.message
  }
  return errors
}

export function invalid(error: ZodError, message = 'Please fix the highlighted fields.'): ActionState {
  return { status: 'error', message, fieldErrors: fieldErrorsFrom(error) }
}

export function failure(message: string): ActionState {
  return { status: 'error', message }
}

export function success(message: string): ActionState {
  return { status: 'success', message }
}
