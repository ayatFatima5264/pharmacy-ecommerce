import { Suspense } from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gray-900 px-4 py-12">
      {/* Soft teal glows — the console's identity, rendered in pure CSS. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-blue-600/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-48 right-0 h-[360px] w-[360px] rounded-full bg-blue-500/10 blur-3xl"
      />

      <div className="relative w-full max-w-[420px] animate-slide-up">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Image
            src={siteConfig.logo}
            alt={`${siteConfig.name} logo`}
            width={64}
            height={64}
            className="h-16 w-16 rounded-md bg-white/95 object-contain p-1 shadow-e2"
            priority
          />
          <div>
            <h1 className="text-h2 text-white">{siteConfig.name}</h1>
            <p className="mt-1.5 text-body-sm text-white/50">Sign in to the admin console</p>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white p-6 shadow-e3 sm:p-8">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-gray-100" />}>
            <StaffLoginForm />
          </Suspense>
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-body-sm text-white/50">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Access is logged. Report anything unexpected to your administrator.
        </p>
      </div>
    </div>
  )
}
