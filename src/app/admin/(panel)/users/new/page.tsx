import Link from 'next/link'
import { ChevronLeft, UserPlus } from 'lucide-react'
import { PageHeader } from '@/components/admin/ui'
import { requirePermission } from '@/features/auth/staff/guards'
import { CreateUserForm } from '@/features/users/components/user-forms'

export const metadata = { title: 'Add User' }
export const dynamic = 'force-dynamic'

export default async function NewUserPage() {
  await requirePermission('users.manage')

  return (
    <>
      <Link
        href="/admin/users"
        className="mb-4 inline-flex items-center gap-1 rounded-sm text-[13px] font-semibold text-gray-500 hover:text-blue-600"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to users
      </Link>

      <PageHeader
        title="Add user"
        description="The account can sign in immediately with the password you set here."
      />

      <div className="max-w-2xl rounded-lg border border-gray-200/80 bg-white shadow-e1">
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-600">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">New staff account</h2>
            <p className="text-[12.5px] text-gray-500">
              Pick Administrator for full control, or Staff for view-only monitoring.
            </p>
          </div>
        </div>
        <div className="p-6">
          <CreateUserForm />
        </div>
      </div>
    </>
  )
}
