import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { PageHeader, Panel } from '@/components/admin/ui'
import { requirePermission } from '@/features/auth/staff/guards'
import { getCmsPages } from '@/features/cms/pages'
import { CmsPageForm } from '@/features/cms/components/cms-page-form'
import { formatDate } from '@/lib/utils'

export const metadata = { title: 'Content' }
export const dynamic = 'force-dynamic'

/**
 * Content editor (CMS lean V1): the storefront's policy pages, editable
 * without a deploy. Pages showing "shipped default" have never been edited —
 * saving publishes a database copy that takes over immediately.
 */
export default async function AdminCmsPage() {
  await requirePermission('settings.manage')
  const pages = await getCmsPages()

  return (
    <>
      <PageHeader
        title="Content"
        description="Storefront policy pages. Plain text — blank lines start a new paragraph."
      />

      <div className="flex flex-col gap-4">
        {pages.map((page) => (
          <Panel
            key={page.slug}
            title={page.title}
            action={
              <Link
                href={`/policies/${page.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-blue-600 hover:underline"
              >
                View
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            }
          >
            <p className="mb-3 text-[12.5px] text-gray-500">
              {page.updatedAt
                ? `Last published ${formatDate(page.updatedAt)}`
                : 'Showing the shipped default — never edited.'}
            </p>
            <CmsPageForm slug={page.slug} title={page.title} body={page.body} />
          </Panel>
        ))}
      </div>
    </>
  )
}
