'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { brandSchema, categorySchema } from '../schemas/product-schema'
import { failure, invalid, success, type ActionState } from './action-result'
import {
  brandSlugs,
  categorySlugs,
  findBrand,
  findCategory,
  insertBrand,
  insertCategory,
  removeBrand,
  removeCategory,
  replaceBrand,
  replaceCategory,
  uniqueSlug,
} from '@/lib/data/store'
import { authorizeAction } from '@/features/auth/staff/guards'
import { useDb } from '@/lib/data/source'
import {
  deleteBrandDb,
  deleteCategoryDb,
  saveBrandDb,
  saveCategoryDb,
} from '@/lib/data/db/admin-catalog-db'

/** Each action authorizes independently - see the note in product-actions.ts. */

function revalidateTaxonomy() {
  revalidatePath('/admin/categories')
  revalidatePath('/admin/brands')
  revalidatePath('/admin/products')
  revalidatePath('/pharmacy')
  revalidatePath('/')
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function saveCategory(
  categoryId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authorizeAction('products.manage')
  if (!auth.ok) return failure(auth.message)

  const parsed = categorySchema.safeParse({
    name: String(formData.get('name') ?? ''),
    slug: String(formData.get('slug') ?? ''),
    icon: String(formData.get('icon') ?? ''),
    description: String(formData.get('description') ?? ''),
    parentId: String(formData.get('parentId') ?? ''),
  })
  if (!parsed.success) return invalid(parsed.error)

  const data = parsed.data
  const parentId = data.parentId || null

  if (categoryId && parentId === categoryId) {
    return {
      status: 'error',
      message: 'A category cannot be its own parent.',
      fieldErrors: { parentId: 'Choose a different parent.' },
    }
  }

  if (useDb()) {
    // Note: the emoji icon is code-side by design (config/icons.ts) — the
    // schema accepts it from the form, the database does not store it.
    const result = await saveCategoryDb(categoryId, {
      name: data.name,
      slug: data.slug,
      description: data.description,
      parentId,
    })
    if (!result.ok) return failure(result.message)
    revalidateTaxonomy()
    if (categoryId) return success('Category saved.')
    redirect('/admin/categories?created=1')
  }

  if (categoryId) {
    const existing = findCategory(categoryId)
    if (!existing) return failure('That category no longer exists.')

    replaceCategory(categoryId, {
      ...existing,
      name: data.name,
      slug: uniqueSlug(data.slug || data.name, categorySlugs(), existing.slug),
      icon: data.icon,
      description: data.description,
      parentId,
    })
    revalidateTaxonomy()
    return success('Category saved.')
  }

  insertCategory({
    name: data.name,
    slug: uniqueSlug(data.slug || data.name, categorySlugs()),
    icon: data.icon,
    description: data.description,
    parentId,
  })
  revalidateTaxonomy()
  redirect('/admin/categories?created=1')
}

export async function deleteCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authorizeAction('products.manage')
  if (!auth.ok) return failure(auth.message)

  const categoryId = String(formData.get('categoryId') ?? '')
  // Deletion refuses while children or products still reference it,
  // mirroring `on delete restrict`.
  const result = useDb() ? await deleteCategoryDb(categoryId) : removeCategory(categoryId)
  if (!result.ok) return failure(result.reason ?? 'Could not delete that category.')

  revalidateTaxonomy()
  return success('Category deleted.')
}

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export async function saveBrand(
  brandId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authorizeAction('products.manage')
  if (!auth.ok) return failure(auth.message)

  const parsed = brandSchema.safeParse({
    name: String(formData.get('name') ?? ''),
    slug: String(formData.get('slug') ?? ''),
  })
  if (!parsed.success) return invalid(parsed.error)

  const data = parsed.data

  if (useDb()) {
    const result = await saveBrandDb(brandId, { name: data.name, slug: data.slug })
    if (!result.ok) return failure(result.message)
    revalidateTaxonomy()
    if (brandId) return success('Brand saved.')
    redirect('/admin/brands?created=1')
  }

  if (brandId) {
    const existing = findBrand(brandId)
    if (!existing) return failure('That brand no longer exists.')

    replaceBrand(brandId, {
      ...existing,
      name: data.name,
      slug: uniqueSlug(data.slug || data.name, brandSlugs(), existing.slug),
    })
    revalidateTaxonomy()
    return success('Brand saved.')
  }

  insertBrand({
    name: data.name,
    slug: uniqueSlug(data.slug || data.name, brandSlugs()),
  })
  revalidateTaxonomy()
  redirect('/admin/brands?created=1')
}

export async function deleteBrand(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction('products.manage')
  if (!auth.ok) return failure(auth.message)

  const brandId = String(formData.get('brandId') ?? '')
  const result = useDb() ? await deleteBrandDb(brandId) : removeBrand(brandId)
  if (!result.ok) return failure(result.reason ?? 'Could not delete that brand.')

  revalidateTaxonomy()
  return success('Brand deleted.')
}
