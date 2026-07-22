import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCmsPage, CMS_SLUGS } from '@/features/cms/pages'
import { formatDate } from '@/lib/utils'

type Params = Promise<{ slug: string }>

// CMS-served: re-render at most every 5 minutes after an edit.
export const revalidate = 300

export function generateStaticParams() {
  return CMS_SLUGS.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const page = await getCmsPage(slug)
  return { title: page?.title ?? 'Policy' }
}

/**
 * Policy pages, CMS-served (features/cms). Body is PLAIN TEXT split into
 * paragraphs on blank lines — React escapes everything, so admin-entered
 * content can never inject markup.
 */
export default async function PolicyPage({ params }: { params: Params }) {
  const { slug } = await params
  const page = await getCmsPage(slug)
  if (!page) notFound()

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-h1">{page.title}</h1>
      {page.updatedAt && (
        <p className="mt-1 text-body-sm text-gray-400">
          Last updated {formatDate(page.updatedAt)}
        </p>
      )}
      <div className="mt-6 flex flex-col gap-4">
        {page.body
          .split(/\n{2,}/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean)
          .map((paragraph, i) => (
            <p key={i} className="text-body leading-relaxed text-gray-700">
              {paragraph}
            </p>
          ))}
      </div>
    </div>
  )
}
