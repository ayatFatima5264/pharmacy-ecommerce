import { Contact } from 'lucide-react'
import { PageHeader } from '@/components/admin/ui'
import { requirePermission } from '@/features/auth/staff/guards'
import { getSetting } from '@/features/settings/queries'
import { ContactInfoForm } from '@/features/settings/components/content-forms'

export const metadata = { title: 'Contact Information' }
export const dynamic = 'force-dynamic'

export default async function AdminContactInfoPage() {
  await requirePermission('settings.manage')
  const value = await getSetting('business.info')

  return (
    <>
      <PageHeader
        title="Contact Information"
        description="The business details shown across the storefront — footer, contact page, and WhatsApp button. One save publishes everywhere."
      />

      <div className="max-w-3xl rounded-lg border border-gray-200/80 bg-white shadow-e1">
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-600">
            <Contact className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">Business details</h2>
            <p className="text-[12.5px] text-gray-500">
              Delivery areas are managed in code (config/locations.ts) because checkout enforces
              them — changing coverage is a release, not a setting.
            </p>
          </div>
        </div>
        <div className="p-6">
          <ContactInfoForm value={value} />
        </div>
      </div>
    </>
  )
}
