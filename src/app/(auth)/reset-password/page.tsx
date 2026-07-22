import type { Metadata } from 'next'
import Link from 'next/link'
import { getAuthUser } from '@/features/auth/shared/session'
import { ResetPasswordForm } from '@/features/auth/customer/components/reset-password-form'

export const metadata: Metadata = {
  title: 'Choose a new password',
  robots: { index: false, follow: false },
}

// Depends on the recovery session cookie — never prerender.
export const dynamic = 'force-dynamic'

/**
 * Landing page of the emailed recovery link (via /callback). Requires the
 * recovery session that link established; without one the form could only
 * fail, so explain instead.
 */
export default async function ResetPasswordPage() {
  const user = await getAuthUser()

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-h2">Choose a new password</h1>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-e1 sm:p-8">
        {user ? (
          <ResetPasswordForm />
        ) : (
          <p className="text-body-sm text-gray-600">
            This reset link is invalid or has expired.{' '}
            <Link href="/forgot-password" className="font-semibold text-blue-600 hover:underline">
              Request a new one
            </Link>
            .
          </p>
        )}
      </div>
    </>
  )
}
