import type { Metadata } from 'next'
import { ForgotPasswordForm } from '@/features/auth/customer/components/forgot-password-form'

export const metadata: Metadata = {
  title: 'Forgot password',
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-h2">Reset your password</h1>
        <p className="mt-1 text-body-sm text-gray-500">
          Enter your email and we&rsquo;ll send you a reset link
        </p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-e1 sm:p-8">
        <ForgotPasswordForm />
      </div>
    </>
  )
}
