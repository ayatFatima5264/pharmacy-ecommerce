import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { getCurrentUser } from '@/features/auth/staff/guards'
import { ROLE_LABELS } from '@/features/auth/staff/permissions'

export const metadata = { title: 'Access denied' }

type SearchParams = Promise<{ permission?: string }>

/**
 * 403, not a redirect to login.
 *
 * The user IS authenticated - they simply lack this permission. Bouncing them
 * to a sign-in form would be both a lie and an infinite loop, since signing in
 * again grants nothing new.
 */
export default async function ForbiddenPage({ searchParams }: { searchParams: SearchParams }) {
  const { permission } = await searchParams
  const user = await getCurrentUser()

  return (
    <div className="flex flex-col items-center py-20 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-600/[0.12] text-amber-700">
        <ShieldAlert className="h-8 w-8" aria-hidden="true" />
      </span>

      <h1 className="mt-6 text-[26px] font-bold tracking-[-0.02em] text-gray-900">
        You do not have access to this
      </h1>

      <p className="mt-3 max-w-md text-[13.5px] text-gray-500">
        {user ? (
          <>
            You are signed in as <strong className="text-gray-900">{user.name}</strong> (
            {ROLE_LABELS[user.role]}), and that role does not include
            {permission ? (
              <code className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 text-[12.5px]">
                {permission}
              </code>
            ) : (
              ' this permission'
            )}
            . Ask an administrator if you need it.
          </>
        ) : (
          'Your session may have expired. Sign in again to continue.'
        )}
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Link
          href="/admin"
          className="inline-flex h-9 items-center rounded-sm bg-blue-600 px-4 text-[13.5px] font-semibold text-white hover:bg-blue-700"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
