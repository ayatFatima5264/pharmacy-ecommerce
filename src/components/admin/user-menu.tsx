import Link from 'next/link'
import { Bell, LogOut } from 'lucide-react'
import { staffLogout } from '@/features/auth/staff/actions'
import { ROLE_LABELS } from '@/features/auth/staff/permissions'
import type { AuthUser } from '@/features/auth/staff/guards'

/**
 * Signed-in identity bar.
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
    <div className="flex h-12 items-center justify-end gap-4 border-b border-gray-200 bg-white px-4 md:px-6">
      {/* The bell: count refreshes on every server render (navigation). */}
      <Link
        href="/admin/notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded-sm text-gray-500 hover:bg-gray-100 hover:text-blue-600"
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Link>

      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-[11.5px] font-bold text-blue-700">
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
      </div>

      <form action={staffLogout}>
        <button
          type="submit"
          className="flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-[13px] font-semibold text-gray-500 hover:bg-gray-100 hover:text-red-600"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          Sign out
        </button>
      </form>
    </div>
  )
}
