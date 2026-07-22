import type { Metadata } from 'next'
import { RegisterForm } from '@/features/auth/customer/components/register-form'

export const metadata: Metadata = {
  title: 'Create account',
  robots: { index: false, follow: false },
}

export default function RegisterPage() {
  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-h2">Create your account</h1>
        <p className="mt-1 text-body-sm text-gray-500">
          Track orders, download lab reports, and check out faster
        </p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <RegisterForm />
      </div>
    </>
  )
}
