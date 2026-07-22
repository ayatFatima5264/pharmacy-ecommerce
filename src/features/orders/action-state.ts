/**
 * Action state types and idle constants.
 *
 * These live OUTSIDE the 'use server' modules on purpose: a "use server" file
 * may only export async functions, so exporting a plain object from one is a
 * build error. Keeping the constants here lets client components import an
 * initial state without dragging in the server module's exports.
 */

export type StatusUpdateState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

export const idleStatusState: StatusUpdateState = { status: 'idle' }

export type PlaceOrderState =
  | { status: 'idle' }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> }
  | { status: 'success'; orderNumber: string }

export const idlePlaceOrderState: PlaceOrderState = { status: 'idle' }

export type LoginState =
  | { status: 'idle' }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> }

export const idleLoginState: LoginState = { status: 'idle' }
