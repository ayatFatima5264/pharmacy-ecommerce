import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ShieldAlert } from 'lucide-react'
import { PageHeader, Panel, StatusPill } from '@/components/admin/ui'
import { Avatar } from '@/components/admin/blocks'
import { requirePermission } from '@/features/auth/staff/guards'
import { ROLE_LABELS } from '@/features/auth/staff/permissions'
import { getStaffUser } from '@/features/users/queries'
import { EditUserForm, UserDangerZone } from '@/features/users/components/user-forms'
import { formatDateTime } from '@/lib/utils'

export const metadata = { title: 'Manage User' }
export const dynamic = 'force-dynamic'

export default async function ManageUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('users.manage')
  const { id } = await params
  const user = await getStaffUser(id)
  if (!user) notFound()

  return (
    <>
      <Link
        href="/admin/users"
        className="mb-4 inline-flex items-center gap-1 rounded-sm text-[13px] font-semibold text-gray-500 hover:text-blue-600"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to users
      </Link>

      {/* Identity band */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200/80 bg-white p-6 shadow-e1">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={user.name} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-bold leading-tight tracking-[-0.02em] text-gray-900">
              {user.name}
            </h1>
            <p className="truncate text-[13px] text-gray-500">{user.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {user.roles.map((role) => (
            <StatusPill key={role} tone={role === 'admin' ? 'accent' : 'neutral'}>
              {ROLE_LABELS[role]}
            </StatusPill>
          ))}
          {user.isActive ? (
            <StatusPill tone="success">Active</StatusPill>
          ) : (
            <StatusPill tone="danger">Inactive</StatusPill>
          )}
          <span className="text-[12.5px] text-gray-400">
            Last login {user.lastSignInAt ? formatDateTime(user.lastSignInAt) : 'never'}
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
        <Panel title="Account details">
          <EditUserForm user={user} />
        </Panel>

        <Panel title="Access actions">
          <div className="mb-4 flex items-start gap-2.5 rounded-md bg-gray-50 p-3 text-[12px] leading-relaxed text-gray-500">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <p>
              You cannot deactivate or delete your own account, and the last active administrator
              can never be removed. All actions here are audit-logged.
            </p>
          </div>
          <UserDangerZone user={user} />
        </Panel>
      </div>
    </>
  )
}
