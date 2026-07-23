import { Share2 } from 'lucide-react'
import { PageHeader } from '@/components/admin/ui'
import { requirePermission } from '@/features/auth/staff/guards'
import { getSetting } from '@/features/settings/queries'
import { SocialLinksForm } from '@/features/settings/components/content-forms'

export const metadata = { title: 'Social Media' }
export const dynamic = 'force-dynamic'

export default async function AdminSocialMediaPage() {
  await requirePermission('settings.manage')
  const value = await getSetting('social.links')

  return (
    <>
      <PageHeader
        title="Social Media"
        description="Profile links shown in the storefront footer. Toggle a network off to hide it without losing its URL."
      />

      <div className="max-w-3xl rounded-lg border border-gray-200/80 bg-white shadow-e1">
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-600">
            <Share2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">Profiles</h2>
            <p className="text-[12.5px] text-gray-500">
              Empty URLs render as placeholder links until the real profile exists.
            </p>
          </div>
        </div>
        <div className="p-6">
          <SocialLinksForm value={value} />
        </div>
      </div>
    </>
  )
}
