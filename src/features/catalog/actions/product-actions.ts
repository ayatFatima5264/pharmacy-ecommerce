'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { productSchema } from '../schemas/product-schema'
import { failure, invalid, success, type ActionState } from './action-result'
import {
  allBatches,
  findProduct,
  insertProduct,
  productSlugs,
  removeProduct,
  replaceProduct,
  uniqueSlug,
} from '@/lib/data/store'
import { authorizeAction } from '@/features/auth/staff/guards'
import { useDb } from '@/lib/data/source'
import {
  deleteProductDb,
  findProductDb,
  getBatchRowsDb,
  insertProductDb,
  setProductActiveDb,
  updateProductDb,
} from '@/lib/data/db/admin-catalog-db'
import type { Product, ProductVariant } from '@/types'

/**
 * SECURITY.
 *
 * Every action in this file is a public POST endpoint, so each one authorizes
 * independently. A page-level guard is not sufficient: a Server Action can be
 * invoked directly without any page ever rendering.
 */

/** Parses the flat FormData the browser sends into the nested product shape. */
function readProductForm(formData: FormData) {
  const lines = (value: FormDataEntryValue | null) =>
    String(value ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

  // Variants and images arrive as parallel indexed fields (variant.0.sku ...).
  const variantCount = Number.parseInt(String(formData.get('variantCount') ?? '0'), 10) || 0
  const variants = Array.from({ length: variantCount }, (_, i) => ({
    id: (formData.get(`variant.${i}.id`) as string) || undefined,
    sku: String(formData.get(`variant.${i}.sku`) ?? ''),
    packSize: String(formData.get(`variant.${i}.packSize`) ?? ''),
    unitsPerPack: String(formData.get(`variant.${i}.unitsPerPack`) ?? ''),
    pricePaisa: String(formData.get(`variant.${i}.price`) ?? ''),
    compareAtPricePaisa: String(formData.get(`variant.${i}.compareAtPrice`) ?? ''),
    inStock: formData.get(`variant.${i}.inStock`) === 'on',
  })).filter((v) => v.sku || v.packSize || v.pricePaisa)

  const imageCount = Number.parseInt(String(formData.get('imageCount') ?? '0'), 10) || 0
  const images = Array.from({ length: imageCount }, (_, i) => ({
    url: String(formData.get(`image.${i}.url`) ?? ''),
    alt: String(formData.get(`image.${i}.alt`) ?? ''),
  })).filter((image) => image.url !== '')

  return {
    name: String(formData.get('name') ?? ''),
    slug: String(formData.get('slug') ?? ''),
    genericName: String(formData.get('genericName') ?? ''),
    brandId: String(formData.get('brandId') ?? ''),
    categorySlugs: formData.getAll('categorySlugs').map(String),
    icon: String(formData.get('icon') ?? '\u{1F48A}') || '\u{1F48A}',
    shortDescription: String(formData.get('shortDescription') ?? ''),
    description: String(formData.get('description') ?? ''),
    requiresPrescription: formData.get('requiresPrescription') === 'on',
    isControlled: formData.get('isControlled') === 'on',
    dosageForm: String(formData.get('dosageForm') ?? ''),
    strength: String(formData.get('strength') ?? ''),
    storageInstructions: String(formData.get('storageInstructions') ?? ''),
    composition: String(formData.get('composition') ?? ''),
    sideEffects: lines(formData.get('sideEffects')),
    warnings: lines(formData.get('warnings')),
    images,
    variants,
  }
}

function revalidateCatalog(slug?: string) {
  revalidatePath('/admin/products')
  revalidatePath('/admin/inventory')
  revalidatePath('/pharmacy')
  revalidatePath('/')
  if (slug) revalidatePath(`/products/${slug}`)
}

export async function createProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authorizeAction('products.manage')
  if (!auth.ok) return failure(auth.message)

  const parsed = productSchema.safeParse(readProductForm(formData))
  if (!parsed.success) return invalid(parsed.error)

  const data = parsed.data

  if (useDb()) {
    const result = await insertProductDb(data)
    if (!result.ok) return failure(result.message)
    revalidateCatalog()
    redirect(`/admin/products/${result.id}/edit?created=1`)
  }

  const slug = uniqueSlug(data.slug || data.name, productSlugs())

  const variants: ProductVariant[] = data.variants.map((variant, i) => ({
    id: variant.id || `var-${crypto.randomUUID().slice(0, 8)}`,
    sku: variant.sku.toUpperCase(),
    packSize: variant.packSize,
    unitsPerPack: variant.unitsPerPack,
    pricePaisa: variant.pricePaisa,
    compareAtPricePaisa: variant.compareAtPricePaisa,
    inStock: variant.inStock,
  }))

  const created = insertProduct({
    slug,
    name: data.name,
    genericName: data.genericName || null,
    brandId: data.brandId,
    categorySlugs: data.categorySlugs,
    icon: data.icon,
    shortDescription: data.shortDescription,
    description: data.description,
    requiresPrescription: data.requiresPrescription,
    dosageForm: data.dosageForm || null,
    strength: data.strength || null,
    storageInstructions: data.storageInstructions || null,
    composition: data.composition || null,
    sideEffects: data.sideEffects,
    warnings: data.warnings,
    images: data.images,
    variants,
  })

  revalidateCatalog(created.slug)
  // redirect() throws internally, so it must sit outside any try/catch.
  redirect(`/admin/products/${created.id}/edit?created=1`)
}

export async function updateProduct(
  productId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authorizeAction('products.manage')
  if (!auth.ok) return failure(auth.message)

  if (useDb()) {
    const dbProduct = await findProductDb(productId)
    if (!dbProduct) return failure('That product no longer exists.')
    const dbParsed = productSchema.safeParse(readProductForm(formData))
    if (!dbParsed.success) return invalid(dbParsed.error)

    const result = await updateProductDb(dbProduct, dbParsed.data)
    if (!result.ok) return failure(result.message)
    revalidateCatalog(dbProduct.slug)
    return success(`Product saved.${result.note ? ` ${result.note}` : ''}`)
  }

  const existing = findProduct(productId)
  if (!existing) return failure('That product no longer exists.')

  const parsed = productSchema.safeParse(readProductForm(formData))
  if (!parsed.success) return invalid(parsed.error)

  const data = parsed.data
  const slug = uniqueSlug(data.slug || data.name, productSlugs(), existing.slug)

  const next: Product = {
    ...existing,
    slug,
    name: data.name,
    genericName: data.genericName || null,
    brandId: data.brandId,
    categorySlugs: data.categorySlugs,
    icon: data.icon,
    shortDescription: data.shortDescription,
    description: data.description,
    requiresPrescription: data.requiresPrescription,
    dosageForm: data.dosageForm || null,
    strength: data.strength || null,
    storageInstructions: data.storageInstructions || null,
    composition: data.composition || null,
    sideEffects: data.sideEffects,
    warnings: data.warnings,
    images: data.images,
    variants: data.variants.map((variant) => ({
      // Preserving variant ids matters: batches and historical order lines
      // point at them. A regenerated id silently orphans stock.
      id: variant.id || `var-${crypto.randomUUID().slice(0, 8)}`,
      sku: variant.sku.toUpperCase(),
      packSize: variant.packSize,
      unitsPerPack: variant.unitsPerPack,
      pricePaisa: variant.pricePaisa,
      compareAtPricePaisa: variant.compareAtPricePaisa,
      inStock: variant.inStock,
    })),
  }

  replaceProduct(productId, next)
  revalidateCatalog(next.slug)
  if (existing.slug !== next.slug) revalidatePath(`/products/${existing.slug}`)

  return success('Product saved.')
}

export async function deleteProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authorizeAction('products.manage')
  if (!auth.ok) return failure(auth.message)

  const productId = String(formData.get('productId') ?? '')
  const product = useDb() ? await findProductDb(productId) : findProduct(productId)
  if (!product) return failure('That product no longer exists.')

  // Typed confirmation: the form requires the exact product name, so a
  // mis-click cannot destroy a catalog row.
  const confirmation = String(formData.get('confirmName') ?? '').trim()
  if (confirmation !== product.name) {
    return {
      status: 'error',
      message: 'The name you typed does not match.',
      fieldErrors: { confirmName: `Type "${product.name}" exactly to confirm.` },
    }
  }

  const heldStock = (
    useDb()
      ? (await getBatchRowsDb()).filter((b) => b.productId === productId)
      : allBatches().filter((b) => b.productId === productId)
  ).reduce((sum, b) => sum + b.quantityOnHand, 0)

  if (heldStock > 0 && formData.get('force') !== 'on') {
    return failure(
      `This product still has ${heldStock.toLocaleString('en-PK')} units in stock. Write the stock off first, or tick the override.`,
    )
  }

  if (useDb()) {
    const result = await deleteProductDb(productId)
    if (!result.ok) return failure(result.message)
    revalidateCatalog(product.slug)
    // Sales/stock history makes a hard delete impossible (RESTRICT FKs) — the
    // product was delisted instead, which is the correct end state anyway.
    redirect(result.deactivated ? '/admin/products?deactivated=1' : '/admin/products?deleted=1')
  }

  removeProduct(productId)
  revalidateCatalog(product.slug)
  redirect('/admin/products?deleted=1')
}

/** Quick toggle from the list - no full form round-trip. */
export async function toggleProductStock(formData: FormData): Promise<void> {
  const auth = await authorizeAction('products.manage')
  if (!auth.ok) return

  const productId = String(formData.get('productId') ?? '')

  if (useDb()) {
    // DB availability derives from batches; the list toggle maps to
    // delist/relist. (The admin list shows active products, so this is
    // effectively "remove from storefront" — relisting comes with the
    // inactive-products view in the next phase.)
    const dbProduct = await findProductDb(productId)
    if (!dbProduct) return
    await setProductActiveDb(productId, false)
    revalidateCatalog(dbProduct.slug)
    return
  }

  const product = findProduct(productId)
  if (!product) return

  const anyInStock = product.variants.some((v) => v.inStock)
  replaceProduct(productId, {
    ...product,
    variants: product.variants.map((v) => ({ ...v, inStock: !anyInStock })),
  })

  revalidateCatalog(product.slug)
}
