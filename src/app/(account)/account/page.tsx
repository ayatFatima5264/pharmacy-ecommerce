import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, FlaskConical, LogOut, MapPin, Package } from 'lucide-react'
import { requireCustomer } from '@/features/auth/customer/guards'
import { customerLogout } from '@/features/auth/customer/actions'

export const metadata: Metadata = {
  title: 'My account',
  robots: { index: false, follow: false },
}

// Session-dependent — never prerender.
export const dynamic = 'force-dynamic'

/**
 * Account landing. Order history, bookings, and addresses arrive with their
 * own modules (Steps 3+) reading through the user-bound client under RLS —
 * the tiles below are the navigation contract for those pages.
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const customer = await requireCustomer('/account')
  const params = await searchParams

  const notice = params['password-updated']
    ? 'Your password has been updated.'
    : params['verified']
      ? 'Your email is verified — welcome!'
      : null

  return (
    <div className="bg-gray-50">
    <div className="container py-10 md:py-12">
      {notice && (
        <div
          role="status"
          className="mb-6 flex items-start gap-2.5 rounded-md border border-green-600/20 bg-green-50 p-3.5 text-body-sm text-green-700"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white"
            aria-hidden="true"
          >
            {customer.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <h1 className="text-h1">Welcome back, {customer.name.split(' ')[0]}</h1>
            <p className="mt-1 text-body text-gray-500">
              Signed in as <span className="font-semibold text-gray-900">{customer.name}</span> (
              {customer.email})
            </p>
          </div>
        </div>
        <form action={customerLogout}>
          <button
            type="submit"
            className="flex h-10 items-center gap-1.5 rounded-sm border border-gray-200 bg-white px-3.5 text-body-sm font-semibold text-gray-600 transition-colors duration-fast hover:bg-gray-50 hover:text-red-600"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Sign out
          </button>
        </form>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/account/orders"
          className="group rounded-lg border border-gray-200 bg-white p-6 shadow-e1 transition-all duration-medium hover:-translate-y-0.5 hover:border-blue-600/30 hover:shadow-e2"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-50 text-blue-600">
            <Package className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-body font-semibold text-gray-900 group-hover:text-blue-600">
            Orders
          </h2>
          <p className="mt-1 text-body-sm text-gray-500">Your order history</p>
        </Link>
        <Link
          href="/lab-tests"
          className="group rounded-lg border border-gray-200 bg-white p-6 shadow-e1 transition-all duration-medium hover:-translate-y-0.5 hover:border-blue-600/30 hover:shadow-e2"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-50 text-blue-600">
            <FlaskConical className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-body font-semibold text-gray-900 group-hover:text-blue-600">
            Lab tests
          </h2>
          <p className="mt-1 text-body-sm text-gray-500">Book a test or package</p>
        </Link>
        <Link
          href="/pharmacy"
          className="group rounded-lg border border-gray-200 bg-white p-6 shadow-e1 transition-all duration-medium hover:-translate-y-0.5 hover:border-blue-600/30 hover:shadow-e2"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-50 text-blue-600">
            <MapPin className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-body font-semibold text-gray-900 group-hover:text-blue-600">
            Pharmacy
          </h2>
          <p className="mt-1 text-body-sm text-gray-500">Continue shopping</p>
        </Link>
      </div>

      <p className="mt-8 text-body-sm text-gray-400">
        Order history, saved addresses, and lab reports appear here as those features launch.
      </p>
    </div>
    </div>
  )
}
