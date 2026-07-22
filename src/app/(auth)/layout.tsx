import Image from 'next/image'
import Link from 'next/link'
import { siteConfig } from '@/config/site'

/**
 * Shared chrome for customer auth pages (/login, /register, /forgot-password,
 * /reset-password): a centered card with the brand mark. Deliberately minimal
 * — no storefront header, nothing to wander off to mid-flow, but the logo
 * still leads home.
 *
 * The staff login does NOT live here: it has its own page under /admin/login
 * with admin-console framing (see the logical separation note in
 * features/auth/shared/session.ts).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-[460px]">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Link
            href="/"
            className="rounded-md transition-opacity duration-fast hover:opacity-80"
            aria-label={`${siteConfig.name} home`}
          >
            <Image
              src={siteConfig.logo}
              alt=""
              width={56}
              height={56}
              priority
              className="h-14 w-14 object-contain"
            />
          </Link>
        </div>
        {children}
      </div>
    </div>
  )
}
