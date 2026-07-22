import type { Metadata } from 'next'
import { AdminSidebar } from '@/components/admin/sidebar'
import { AdminUserMenu } from '@/components/admin/user-menu'
import { requireUser } from '@/features/auth/staff/guards'
import { getDashboardMetrics } from '@/lib/data/admin'

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s Â· Admin' },
  // The console must never be indexed.
  robots: { index: false, follow: false },
}

/**
 * Never prerendered.
 *
 * Every admin page depends on the session cookie, so a build-time snapshot
 * would be both meaningless and dangerous - it would bake one user's view into
 * static HTML. This also stops the build trying to construct staff accounts.
 */
export const dynamic = 'force-dynamic'

/**
 * The admin console runs on a gray-50 ground at 13.5px â€” the one deliberate
 * exception to the storefront's white-background rule. Staff sit here for
 * hours, so density is a kindness; the same density on the storefront would
 * read as noise.
 *
 * SECURITY: this layout is the authentication boundary for every /admin route.
 * Middleware also redirects cookie-less visitors, but that is a cheap rejection
 * on the edge, not the boundary â€” a layout guard runs with real session state
 * and cannot be bypassed by a bad matcher.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser('/admin')
  const metrics = await getDashboardMetrics()

  return (
    <div className="min-h-screen bg-gray-50 text-gray-700">
      <a href="#admin-main" className="skip-link">
        Skip to content
      </a>

      <AdminSidebar
        badges={{ awaitingRx: metrics.awaitingRx, pendingBookings: metrics.pendingBookings }}
      />

      <div className="lg:pl-60">
        <AdminUserMenu user={user} />
        <main id="admin-main" className="mx-auto max-w-[1400px] p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
