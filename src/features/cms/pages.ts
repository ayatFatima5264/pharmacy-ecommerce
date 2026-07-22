import 'server-only'
import { cache } from 'react'
import { isSupabaseConfigured } from '@/config/env'
import { supabaseService } from '@/lib/supabase/server'
import { siteConfig } from '@/config/site'

/**
 * CMS pages, lean V1 (docs/CMS.md): admin-editable plain-text pages with code
 * defaults as the fail-safe layer. Body is plain text — rendered through
 * React (escaped by construction), paragraphs split on blank lines. Every
 * save snapshots a version row.
 */

export interface CmsPage {
  slug: string
  title: string
  body: string
  updatedAt: string | null
}

/** The pages that always exist, with their shipped default content. */
export const CMS_DEFAULTS: Record<string, { title: string; body: string }> = {
  privacy: {
    title: 'Privacy Policy',
    body: `${siteConfig.name} collects only the information needed to fulfil your order: your name, contact details, delivery address, and the items you purchase.\n\nPrescriptions and lab reports are health records. They are stored in private, access-controlled storage, are never shared with third parties, and every access by our staff is logged.\n\nWe never sell your personal information. Payment card details are handled by our payment partners and never touch our servers.\n\nTo request a copy or deletion of your data, contact us at ${siteConfig.email}.`,
  },
  terms: {
    title: 'Terms of Service',
    body: `By placing an order with ${siteConfig.name} you confirm that the information you provide is accurate and that prescription medicines will only be used by the person they are prescribed for.\n\nPrescription items are dispensed only after review by a licensed pharmacist. We may decline an order where a prescription is missing, expired, or unclear — you will be contacted and any payment refunded.\n\nPrices include applicable taxes unless stated otherwise. We reserve the right to correct obvious pricing errors before dispatch.\n\nThese terms are governed by the laws of Pakistan.`,
  },
  shipping: {
    title: 'Shipping Policy',
    body: `Orders are dispatched from our nearest branch, usually within 24 hours of confirmation.\n\nDelivery estimates by zone are shown at checkout before you pay. Metro areas typically receive orders within 1 business day; upcountry addresses within 2–5 business days.\n\nCold-chain items travel in insulated packaging. If a delivery attempt fails, our courier retries the next business day and our team contacts you.\n\nDelivery is free above the threshold shown in your cart; otherwise the zone rate applies.`,
  },
  returns: {
    title: 'Return Policy',
    body: `Medicines cannot be returned once dispatched, in line with DRAP regulations — except when an item arrives damaged, expired, or incorrect. In those cases contact us within 48 hours of delivery and we will replace it or refund you in full.\n\nUnopened medical devices and personal-care items can be returned within 7 days of delivery.\n\nLab bookings can be rescheduled or cancelled free of charge up to 12 hours before the collection slot.\n\nRefunds are issued to the original payment method, or as cash-on-delivery reversal for COD orders, within 5–7 business days.`,
  },
}

export const CMS_SLUGS = Object.keys(CMS_DEFAULTS)

/** DB row if present and published, shipped default otherwise. */
export const getCmsPage = cache(async (slug: string): Promise<CmsPage | null> => {
  const fallback = CMS_DEFAULTS[slug]

  if (isSupabaseConfigured()) {
    const { data } = await supabaseService()
      .from('cms_pages')
      .select('slug, title, body, is_published, updated_at')
      .eq('slug', slug)
      .maybeSingle()
    const row = data as
      | { slug: string; title: string; body: string; is_published: boolean; updated_at: string }
      | null
    if (row && row.is_published) {
      return { slug: String(row.slug), title: row.title, body: row.body, updatedAt: row.updated_at }
    }
  }

  if (!fallback) return null
  return { slug, title: fallback.title, body: fallback.body, updatedAt: null }
})

/** All managed pages for the admin editor (DB overlaying defaults). */
export async function getCmsPages(): Promise<CmsPage[]> {
  return (await Promise.all(CMS_SLUGS.map((slug) => getCmsPage(slug)))).filter(
    (page): page is CmsPage => page !== null,
  )
}
