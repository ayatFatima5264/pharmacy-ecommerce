import { Suspense } from 'react'
import type { Metadata } from 'next'
import { CustomerLoginForm } from '@/features/auth/customer/components/login-form'
import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
  title: 'Sign in',
  // A login page has no SEO value and indexing it only advertises the surface.
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-h2">Welcome back</h1>
        <p className="mt-1 text-body-sm text-gray-500">
          Sign in to your {siteConfig.name} account
        </p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-e1 sm:p-8">
        <Suspense fallback={<div className="h-72 animate-pulse rounded-sm bg-gray-100" />}>
          <CustomerLoginForm />
        </Suspense>
      </div>
    </>
  )
}
