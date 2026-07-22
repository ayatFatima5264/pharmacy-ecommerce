'use client'

import * as React from 'react'
import Link from 'next/link'
import { useActionState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  AdminCheckbox,
  AdminField,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  FormBanner,
  FormSection,
  SubmitButton,
  fieldError,
} from '@/components/admin/form-kit'
import { idleState, type ActionState } from '@/features/catalog/actions/action-result'
import { discountPercent, formatPrice } from '@/lib/utils'
import type { Brand, Category, Product } from '@/types'

interface VariantRow {
  key: string
  id?: string
  sku: string
  packSize: string
  unitsPerPack: string
  price: string
  compareAtPrice: string
  inStock: boolean
}

interface ImageRow {
  key: string
  url: string
  alt: string
}

const paisaToRupees = (paisa: number | null | undefined) =>
  paisa === null || paisa === undefined ? '' : String(paisa / 100)

const newKey = () => Math.random().toString(36).slice(2, 9)

function emptyVariant(): VariantRow {
  return { key: newKey(), sku: '', packSize: '', unitsPerPack: '', price: '', compareAtPrice: '', inStock: true }
}

export function ProductForm({
  action,
  product,
  brands,
  categories,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  product?: Product
  brands: Brand[]
  categories: Category[]
  submitLabel: string
}) {
  const [state, formAction] = useActionState(action, idleState)

  const [variants, setVariants] = React.useState<VariantRow[]>(
    product
      ? product.variants.map((v) => ({
          key: newKey(),
          id: v.id,
          sku: v.sku,
          packSize: v.packSize,
          unitsPerPack: v.unitsPerPack ? String(v.unitsPerPack) : '',
          price: paisaToRupees(v.pricePaisa),
          compareAtPrice: paisaToRupees(v.compareAtPricePaisa),
          inStock: v.inStock,
        }))
      : [emptyVariant()],
  )

  const [images, setImages] = React.useState<ImageRow[]>(
    (product?.images ?? []).map((image) => ({ key: newKey(), url: image.url, alt: image.alt })),
  )

  const [requiresRx, setRequiresRx] = React.useState(product?.requiresPrescription ?? false)
  const [isControlled, setIsControlled] = React.useState(false)

  function updateVariant(key: string, patch: Partial<VariantRow>) {
    setVariants((prev) => prev.map((v) => (v.key === key ? { ...v, ...patch } : v)))
  }

  // Errors come back keyed by Zod path — variants.0.sku — so each row can show
  // its own message rather than dumping everything at the top.
  const err = (key: string) => fieldError(state, key)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormBanner state={state} />

      {/* Nested arrays cannot be expressed in flat FormData, so the server is
          told how many rows to read back. */}
      <input type="hidden" name="variantCount" value={variants.length} />
      <input type="hidden" name="imageCount" value={images.length} />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="flex flex-col gap-4">
          <FormSection title="Basics">
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Product name" name="name" required error={err('name')} className="sm:col-span-2">
                <AdminInput
                  id="name"
                  name="name"
                  defaultValue={product?.name}
                  placeholder="Panadol Extra 500mg"
                  aria-invalid={!!err('name')}
                  required
                />
              </AdminField>

              <AdminField
                label="Generic name"
                name="genericName"
                error={err('genericName')}
                hint="The molecule. Many customers search by this, not the brand."
              >
                <AdminInput
                  id="genericName"
                  name="genericName"
                  defaultValue={product?.genericName ?? ''}
                  placeholder="Paracetamol + Caffeine"
                />
              </AdminField>

              <AdminField
                label="URL slug"
                name="slug"
                error={err('slug')}
                hint="Leave blank to generate from the name."
              >
                <AdminInput id="slug" name="slug" defaultValue={product?.slug} placeholder="panadol-extra-500mg" />
              </AdminField>

              <AdminField label="Brand" name="brandId" required error={err('brandId')}>
                <AdminSelect id="brandId" name="brandId" defaultValue={product?.brandId ?? ''} required>
                  <option value="">Choose a brand…</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </AdminSelect>
              </AdminField>

              <AdminField label="Icon" name="icon" error={err('icon')} hint="Shown until an image is added.">
                <AdminInput id="icon" name="icon" defaultValue={product?.icon ?? '💊'} maxLength={8} />
              </AdminField>

              <AdminField
                label="Short description"
                name="shortDescription"
                required
                error={err('shortDescription')}
                hint="One line, shown on cards and in search results."
                className="sm:col-span-2"
              >
                <AdminInput
                  id="shortDescription"
                  name="shortDescription"
                  defaultValue={product?.shortDescription}
                  maxLength={200}
                  required
                />
              </AdminField>

              <AdminField
                label="Full description"
                name="description"
                required
                error={err('description')}
                className="sm:col-span-2"
              >
                <AdminTextarea id="description" name="description" defaultValue={product?.description} required />
              </AdminField>
            </div>
          </FormSection>

          <FormSection
            title="Pack sizes, pricing and discounts"
            description="Each pack size is its own SKU with its own price and stock. Set a compare-at price to show a discount."
          >
            {err('variants') && (
              <p className="mb-3 text-[12.5px] text-red-600">{err('variants')}</p>
            )}

            <div className="flex flex-col gap-3">
              {variants.map((variant, i) => {
                const price = Number.parseFloat(variant.price)
                const compareAt = Number.parseFloat(variant.compareAtPrice)
                const percent =
                  Number.isFinite(price) && Number.isFinite(compareAt)
                    ? discountPercent(price * 100, compareAt * 100)
                    : null

                return (
                  <div key={variant.key} className="rounded-sm border border-gray-200 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-[13px] font-bold text-gray-900">Pack size {i + 1}</h3>
                      {variants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setVariants((prev) => prev.filter((v) => v.key !== variant.key))}
                          className="flex h-8 items-center gap-1.5 rounded-sm px-2 text-[12.5px] font-semibold text-gray-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Remove
                        </button>
                      )}
                    </div>

                    {variant.id && <input type="hidden" name={`variant.${i}.id`} value={variant.id} />}

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <AdminField label="SKU" name={`variant.${i}.sku`} required error={err(`variants.${i}.sku`)}>
                        <AdminInput
                          id={`variant.${i}.sku`}
                          name={`variant.${i}.sku`}
                          value={variant.sku}
                          onChange={(e) => updateVariant(variant.key, { sku: e.target.value })}
                          placeholder="PAN-EX-10"
                          className="tabular uppercase"
                          required
                        />
                      </AdminField>

                      <AdminField
                        label="Pack size"
                        name={`variant.${i}.packSize`}
                        required
                        error={err(`variants.${i}.packSize`)}
                      >
                        <AdminInput
                          id={`variant.${i}.packSize`}
                          name={`variant.${i}.packSize`}
                          value={variant.packSize}
                          onChange={(e) => updateVariant(variant.key, { packSize: e.target.value })}
                          placeholder="Strip of 10"
                          required
                        />
                      </AdminField>

                      <AdminField
                        label="Units per pack"
                        name={`variant.${i}.unitsPerPack`}
                        error={err(`variants.${i}.unitsPerPack`)}
                        hint="Enables per-unit pricing"
                      >
                        <AdminInput
                          id={`variant.${i}.unitsPerPack`}
                          name={`variant.${i}.unitsPerPack`}
                          value={variant.unitsPerPack}
                          onChange={(e) => updateVariant(variant.key, { unitsPerPack: e.target.value })}
                          inputMode="numeric"
                          placeholder="10"
                          className="tabular"
                        />
                      </AdminField>

                      <AdminField
                        label="Selling price (Rs)"
                        name={`variant.${i}.price`}
                        required
                        error={err(`variants.${i}.pricePaisa`)}
                      >
                        <AdminInput
                          id={`variant.${i}.price`}
                          name={`variant.${i}.price`}
                          value={variant.price}
                          onChange={(e) => updateVariant(variant.key, { price: e.target.value })}
                          inputMode="decimal"
                          placeholder="450"
                          className="tabular"
                          required
                        />
                      </AdminField>

                      <AdminField
                        label="Compare-at price (Rs)"
                        name={`variant.${i}.compareAtPrice`}
                        error={err(`variants.${i}.compareAtPricePaisa`)}
                        hint="The struck-through price. Leave blank if not on sale."
                      >
                        <AdminInput
                          id={`variant.${i}.compareAtPrice`}
                          name={`variant.${i}.compareAtPrice`}
                          value={variant.compareAtPrice}
                          onChange={(e) => updateVariant(variant.key, { compareAtPrice: e.target.value })}
                          inputMode="decimal"
                          placeholder="500"
                          className="tabular"
                        />
                      </AdminField>

                      <div className="flex items-end pb-1">
                        <AdminCheckbox
                          name={`variant.${i}.inStock`}
                          label="In stock"
                          checked={variant.inStock}
                          onChange={(checked) => updateVariant(variant.key, { inStock: checked })}
                        />
                      </div>
                    </div>

                    {/* Live discount preview — the person setting the price sees
                        exactly what the customer will see. */}
                    {percent !== null && percent > 0 && (
                      <p className="tabular mt-3 rounded-sm bg-green-50 px-3 py-2 text-[12.5px] font-semibold text-green-700">
                        Shows as {formatPrice(price * 100)} down from {formatPrice(compareAt * 100)} — {percent}% off
                      </p>
                    )}
                    {Number.isFinite(compareAt) && Number.isFinite(price) && compareAt <= price && variant.compareAtPrice !== '' && (
                      <p className="mt-3 rounded-sm bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-red-600">
                        Compare-at price must be higher than the selling price, or the discount is meaningless.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => setVariants((prev) => [...prev, emptyVariant()])}
              className="mt-3 flex h-9 items-center gap-1.5 rounded-sm border border-gray-200 bg-white px-3 text-[13px] font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add another pack size
            </button>
          </FormSection>

          <FormSection
            title="Images"
            description="Images are referenced by URL in this build. File upload arrives with Supabase Storage."
          >
            {images.length === 0 && (
              <p className="mb-3 rounded-sm bg-gray-50 px-3 py-2.5 text-[12.5px] text-gray-500">
                No images yet — the icon above is used as a placeholder.
              </p>
            )}

            <div className="flex flex-col gap-3">
              {images.map((image, i) => (
                <div key={image.key} className="flex flex-col gap-3 rounded-sm border border-gray-200 p-3 sm:flex-row">
                  <div className="grid flex-1 gap-3 sm:grid-cols-2">
                    <AdminField label="Image URL" name={`image.${i}.url`} error={err(`images.${i}.url`)}>
                      <AdminInput
                        id={`image.${i}.url`}
                        name={`image.${i}.url`}
                        value={image.url}
                        onChange={(e) =>
                          setImages((prev) =>
                            prev.map((row) => (row.key === image.key ? { ...row, url: e.target.value } : row)),
                          )
                        }
                        placeholder="https://…"
                        type="url"
                      />
                    </AdminField>
                    {/* Alt text is required, not optional — an unlabelled
                        product image is invisible to a screen reader. */}
                    <AdminField
                      label="Alt text"
                      name={`image.${i}.alt`}
                      required
                      error={err(`images.${i}.alt`)}
                      hint="Describe the image for screen readers"
                    >
                      <AdminInput
                        id={`image.${i}.alt`}
                        name={`image.${i}.alt`}
                        value={image.alt}
                        onChange={(e) =>
                          setImages((prev) =>
                            prev.map((row) => (row.key === image.key ? { ...row, alt: e.target.value } : row)),
                          )
                        }
                        placeholder="Panadol Extra strip of 10 tablets"
                      />
                    </AdminField>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((row) => row.key !== image.key))}
                    aria-label={`Remove image ${i + 1}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center self-end rounded-sm text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>

            {images.length < 8 && (
              <button
                type="button"
                onClick={() => setImages((prev) => [...prev, { key: newKey(), url: '', alt: '' }])}
                className="mt-3 flex h-9 items-center gap-1.5 rounded-sm border border-gray-200 bg-white px-3 text-[13px] font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add image
              </button>
            )}
          </FormSection>

          <FormSection title="Clinical details" description="Shown in the accordions on the product page.">
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Dosage form" name="dosageForm" error={err('dosageForm')}>
                <AdminInput id="dosageForm" name="dosageForm" defaultValue={product?.dosageForm ?? ''} placeholder="Tablet" />
              </AdminField>
              <AdminField label="Strength" name="strength" error={err('strength')}>
                <AdminInput id="strength" name="strength" defaultValue={product?.strength ?? ''} placeholder="500mg" />
              </AdminField>
              <AdminField label="Composition" name="composition" error={err('composition')} className="sm:col-span-2">
                <AdminTextarea
                  id="composition"
                  name="composition"
                  defaultValue={product?.composition ?? ''}
                  className="min-h-16"
                />
              </AdminField>
              <AdminField
                label="Storage instructions"
                name="storageInstructions"
                error={err('storageInstructions')}
                className="sm:col-span-2"
              >
                <AdminInput
                  id="storageInstructions"
                  name="storageInstructions"
                  defaultValue={product?.storageInstructions ?? ''}
                  placeholder="Store below 25°C in a dry place"
                />
              </AdminField>
              <AdminField label="Side effects" name="sideEffects" hint="One per line" error={err('sideEffects')}>
                <AdminTextarea
                  id="sideEffects"
                  name="sideEffects"
                  defaultValue={product?.sideEffects.join('\n')}
                  placeholder={'Nausea\nHeadache'}
                />
              </AdminField>
              <AdminField label="Warnings" name="warnings" hint="One per line" error={err('warnings')}>
                <AdminTextarea
                  id="warnings"
                  name="warnings"
                  defaultValue={product?.warnings.join('\n')}
                  placeholder={'Do not exceed 8 tablets in 24 hours'}
                />
              </AdminField>
            </div>
          </FormSection>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
          <FormSection title="Categories">
            {err('categorySlugs') && (
              <p className="mb-2 text-[12.5px] text-red-600">{err('categorySlugs')}</p>
            )}
            <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
              {categories.map((category) => (
                <label
                  key={category.id}
                  htmlFor={`cat-${category.slug}`}
                  className="flex cursor-pointer items-center gap-2.5 text-[13.5px] text-gray-700"
                >
                  <input
                    id={`cat-${category.slug}`}
                    type="checkbox"
                    name="categorySlugs"
                    value={category.slug}
                    defaultChecked={product?.categorySlugs.includes(category.slug)}
                    className="h-4 w-4 shrink-0 cursor-pointer rounded-[3px] border-gray-200 text-blue-600 focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                  />
                  <span aria-hidden="true">{category.icon}</span>
                  {category.name}
                </label>
              ))}
            </div>
          </FormSection>

          <FormSection title="Regulatory">
            <div className="flex flex-col gap-3.5">
              <AdminCheckbox
                name="requiresPrescription"
                label="Prescription only"
                description="Blocks checkout until a pharmacist verifies a prescription."
                checked={requiresRx}
                onChange={(checked) => {
                  setRequiresRx(checked)
                  if (!checked) setIsControlled(false)
                }}
              />
              <AdminCheckbox
                name="isControlled"
                label="Controlled substance"
                description="Narcotics and psychotropics. Forces prescription-only."
                checked={isControlled}
                onChange={(checked) => {
                  setIsControlled(checked)
                  // A controlled drug is prescription-only by definition, so
                  // ticking this ticks that too rather than failing later.
                  if (checked) setRequiresRx(true)
                }}
              />
              {err('requiresPrescription') && (
                <p className="text-[12.5px] text-red-600">{err('requiresPrescription')}</p>
              )}
              {requiresRx && (
                <p className="rounded-sm bg-amber-50 px-3 py-2 text-[12.5px] text-amber-700">
                  Customers will see an Rx badge on the card, product page, cart, and checkout.
                </p>
              )}
            </div>
          </FormSection>

          <div className="flex flex-wrap gap-2">
            <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
            <Link
              href="/admin/products"
              className="inline-flex h-9 items-center rounded-sm border border-gray-200 bg-white px-4 text-[13.5px] font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </form>
  )
}
