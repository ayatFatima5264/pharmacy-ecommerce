import { redirect } from 'next/navigation'

/**
 * There is exactly ONE place to browse medicine categories: the Pharmacy page.
 * A bare /categories visit lands there instead of a duplicate listing.
 * Individual /categories/[slug] pages remain — they are filtered product
 * listings, not duplicates.
 */
export default function CategoriesIndexPage() {
  redirect('/pharmacy#categories')
}
