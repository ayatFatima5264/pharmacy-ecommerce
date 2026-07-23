import Link from 'next/link'
import { Pencil, Plus, ShieldCheck, UserCog, Users } from 'lucide-react'
import { PageHeader, StatCard, StatusPill } from '@/components/admin/ui'
import { AdminEmptyState, Avatar } from '@/components/admin/blocks'
import { DataTable, type Column } from '@/components/admin/data-table'
import { requirePermission } from '@/features/auth/staff/guards'
import { ROLE_LABELS } from '@/features/auth/staff/permissions'
import { getStaffUsers, countActiveAdmins, type StaffUser } from '@/features/users/queries'
import { formatDate, formatDateTime } from '@/lib/utils'

export const metadata = { title: 'Users & Roles' }
export const dynamic = 'force-dynamic'

const ROLE_TONES = {
  admin: 'accent',
  manager: 'info',
  pharmacist: 'success',
  support: 'neutral',
} as const

export default async function AdminUsersPage() {
  await requirePermission('users.manage')
  const users = await getStaffUsers()
  const admins = countActiveAdmins(users)

  const columns: Column<StaffUser>[] = [
    {
      key: 'user',
      header: 'User',
      primary: true,
      cell: (user) => (
        <div className="flex items-center gap-3">
          <Avatar name={user.name} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-900">{user.name}</p>
            <p className="truncate text-[12.5px] text-gray-500">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      hideOnMobile: true,
      cell: (user) => <span className="tabular">{user.phone ?? '—'}</span>,
    },
    {
      key: 'roles',
      header: 'Role',
      cell: (user) => (
        <span className="flex flex-wrap gap-1.5">
          {user.roles.map((role) => (
            <StatusPill key={role} tone={ROLE_TONES[role]}>
              {ROLE_LABELS[role]}
            </StatusPill>
          ))}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (user) =>
        user.isActive ? (
          <StatusPill tone="success">Active</StatusPill>
        ) : (
          <StatusPill tone="danger">Inactive</StatusPill>
        ),
    },
    {
      key: 'lastLogin',
      header: 'Last login',
      hideOnMobile: true,
      cell: (user) => (
        <span className="whitespace-nowrap text-[12.5px] text-gray-500">
          {user.lastSignInAt ? formatDateTime(user.lastSignInAt) : '—'}
        </span>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      hideOnMobile: true,
      cell: (user) => <span className="whitespace-nowrap">{formatDate(user.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (user) => (
        <Link
          href={`/admin/users/${user.id}`}
          aria-label={`Manage ${user.name}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 px-3 text-[12.5px] font-semibold text-gray-700 transition-colors duration-fast hover:border-blue-600/30 hover:bg-blue-50/50 hover:text-blue-700"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Manage
        </Link>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Users & Roles"
        description="Staff accounts and their access. Administrators manage everything; Staff monitors without editing."
        action={
          <Link
            href="/admin/users/new"
            className="flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-[13.5px] font-semibold text-white shadow-e1 transition-all duration-medium hover:bg-blue-700 hover:shadow-e2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add user
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Staff accounts" icon={Users} value={String(users.length)} />
        <StatCard
          label="Active"
          icon={UserCog}
          value={String(users.filter((u) => u.isActive).length)}
          tone="success"
        />
        <StatCard
          label="Administrators"
          icon={ShieldCheck}
          value={String(admins)}
          hint={admins <= 1 ? 'The last admin cannot be removed' : undefined}
        />
        <StatCard
          label="Staff (view-only)"
          icon={Users}
          value={String(users.filter((u) => u.primaryRole === 'support').length)}
        />
      </div>

      <DataTable
        columns={columns}
        rows={users}
        rowKey={(user) => user.id}
        caption="Staff accounts"
        empty={
          <AdminEmptyState
            icon={UserCog}
            title="No staff accounts yet"
            description="Accounts appear here once they hold a role. Create the first one with Add user."
            action={
              <Link
                href="/admin/users/new"
                className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-4 text-[13px] font-semibold text-white shadow-e1 transition-colors duration-fast hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add user
              </Link>
            }
          />
        }
      />

      <p className="mt-4 text-[12.5px] text-gray-500">
        Every create, edit, role change, password reset, and delete is written to the audit log.
        Staff members attempting a restricted action see a permission notice instead of the action
        applying.
      </p>
    </>
  )
}
