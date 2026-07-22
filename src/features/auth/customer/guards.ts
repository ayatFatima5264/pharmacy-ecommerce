import 'server-only'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { getAuthUser } from '@/features/auth/shared/session'

/**
 * CUSTOMER guards.
 *
 * Deliberately thin: customer authorization is ROW OWNERSHIP, enforced by RLS
 * (0014_rls.sql) whenever data flows through the user-bound client. The only
 * question a customer page needs answered up front is "is somebody signed
 * in" -- everything after that, the database decides.
 *
 * No role/permission logic here, ever. Staff live in features/auth/staff/.
 * A staff member visiting their own /account is just another customer.
 */

export interface CustomerUser {
  id: string
  email: string
  name: string
  emailVerified: boolean
}

function toCustomerUser(user: User): CustomerUser {
  return {
    id: user.id,
    email: user.email ?? '',
    name: ((user.user_metadata?.full_name as string | undefined) ?? '').trim() || 'Customer',
    emailVerified: Boolean(user.email_confirmed_at),
  }
}

/** The signed-in user in customer context, or null. Never throws. */
export async function getCustomer(): Promise<CustomerUser | null> {
  const user = await getAuthUser()
  return user ? toCustomerUser(user) : null
}

/** Requires a signed-in user, or redirects to the customer login. */
export async function requireCustomer(returnTo?: string): Promise<CustomerUser> {
  const customer = await getCustomer()
  if (!customer) {
    const target = returnTo ? `?next=${encodeURIComponent(returnTo)}` : ''
    redirect(`/login${target}`)
  }
  return customer
}
