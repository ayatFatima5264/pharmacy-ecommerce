import Link from 'next/link'
import { Bell, LogOut } from 'lucide-react'
import { staffLogout } from '@/features/auth/staff/actions'
import { ROLE_LABELS } from '@/features/auth/staff/permissions'
import { AdminBreadcrumb, AdminSearch, DarkModeToggle } from '@/components/admin/header-tools'
import type { AuthUser } from '@/features/auth/staff/guards'

/**
 * Sticky console header: breadcrumb · search · notifications · identity.
 *
 * Showing who you are signed in as is a security feature, not decoration: a
 * pharmacist who thinks they are an admin will not understand why a button is
 * missing, and a shared workstation makes wrong-account actions easy.
 *
 * Logout is a form POST, not a link. A GET logout can be triggered by any
 * <img src="/logout"> on a third-party page.
 */
export function AdminUserMenu({ user, unreadCount = 0 }: { user: AuthUser; unreadCount?: number }) {
  return (
    <div className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-200/80 bg-white/90 px-4 backdrop-blur-md md:px-6">
      <AdminBreadcrumb />

      <div className="ml-auto flex items-center gap-2">
        <AdminSearch />
        <DarkModeToggle />

        {/* The bell: count refreshes on every server render (navigation). */}
        <Link
          href="/admin/notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-colors duration-fast hover:bg-blue-50 hover:text-blue-600"
          aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
      </div>

      <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-[12px] font-bold text-white shadow-e1">
          {user.name
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)}
        </span>
        <span className="hidden sm:block">
          <span className="block text-[13px] font-semibold leading-tight text-gray-900">
            {user.name}
          </span>
          <span className="block text-[11.5px] leading-tight text-gray-500">
            {ROLE_LABELS[user.role]}
          </span>
        </span>

        <form action={staffLogout}>
          <button
            type="submit"
            title="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-md text-gray-400 transition-colors duration-fast hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Sign out</span>
          </button>
        </form>
      </div>
    </div>
  )
}
