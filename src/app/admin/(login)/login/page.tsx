import { Suspense } from 'react'
import type { Metadata } from 'next'
import { ShieldCheck } from 'lucide-react'
import { StaffLoginForm } from '@/features/auth/staff/components/staff-login-form'
import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
  title: 'Staff sign in',
  // A login page has no SEO value and indexing it only advertises the surface.
  robots: { index: false, follow: false },
}

/**
 * Staff entrance to the admin console. Lives in the (login) route group so it
 * renders OUTSIDE the (panel) layout whose auth guard would otherwise loop
 * every signed-out visitor straight back here.
 */
export default function StaffLoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-600 text-lg font-bold text-white">
            S
          </span>
          <div>
            <h1 className="text-h2">{siteConfig.name} staff</h1>
            <p className="mt-1 text-body-sm text-gray-500">Sign in to the admin console</p>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-sm bg-gray-100" />}>
            <StaffLoginForm />
          </Suspense>
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-body-sm text-gray-500">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Access is logged. Report anything unexpected to your administrator.
        </p>
      </div>
    </div>
  )
}
