import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AlertTriangle, Beaker, Boxes, Thermometer } from 'lucide-react'
import { Breadcrumbs, MediaPlaceholder, SectionHeading } from '@/components/shared/primitives'
import { BuyBox, StickyBuyBar } from '@/features/catalog/components/buy-box'
import { ProductCard } from '@/features/catalog/components/cards'
import { ProductGallery } from '@/features/catalog/components/product-gallery'
import { ProductTabs, type ProductTab } from '@/features/catalog/components/product-tabs'
import {
  getBrandName,
  getProductBySlug,
  getProducts,
  getRelatedProducts,
  getSimilarGenerics,
  lowestPrice,
} from '@/lib/data/queries'
import { formatPrice } from '@/lib/utils'
import { siteConfig } from '@/config/site'

export const revalidate = 3600

type Params = Promise<{ slug: string }>

export async function generateStaticParams() {
  const products = await getProducts()
  return products.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) return { title: 'Product not found' }

  return {
    title: product.name,
    description: product.shortDescription,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.name,
      description: product.shortDescription,
      type: 'website',
    },
  }
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()

  const [related, generics] = await Promise.all([
    getRelatedProducts(product),
    getSimilarGenerics(product),
  ])
  const brandName = getBrandName(product.brandId)

  // Product structured data. Rendered server-side so crawlers see it in the
  // initial HTML.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription,
    brand: { '@type': 'Brand', name: brandName },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'PKR',
      lowPrice: (lowestPrice(product) / 100).toFixed(0),
      offerCount: product.variants.length,
      availability: product.variants.some((v) => v.inStock)
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: siteConfig.name },
    },
  }

  // Tab content is assembled here, server-side, so it ships in the initial
  // HTML — the client tabs component only toggles visibility. Tabs with no
  // content are simply never created.
  const hasDirections = Boolean(
    product.dosageForm || product.strength || product.storageInstructions,
  )
  const hasWarnings = product.warnings.length > 0 || product.sideEffects.length > 0

  const allTabs: (ProductTab | null)[] = [
    product.description
      ? {
          id: 'description',
          label: 'Description',
          content: (
            <p className="max-w-2xl text-body leading-relaxed text-gray-700">
              {product.description}
            </p>
          ),
        }
      : null,
    hasDirections
      ? {
          id: 'directions',
          label: 'Directions',
          content: (
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {product.dosageForm && (
                <div className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                    <Boxes className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <dt className="text-body-sm text-gray-500">Dosage form</dt>
                  <dd className="text-body font-semibold text-gray-900">{product.dosageForm}</dd>
                </div>
              )}
              {product.strength && (
                <div className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                    <Beaker className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <dt className="text-body-sm text-gray-500">Strength</dt>
                  <dd className="text-body font-semibold text-gray-900">{product.strength}</dd>
                </div>
              )}
              {product.storageInstructions && (
                <div className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                    <Thermometer className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <dt className="text-body-sm text-gray-500">Storage</dt>
                  <dd className="text-body font-semibold text-gray-900">
                    {product.storageInstructions}
                  </dd>
                </div>
              )}
            </dl>
          ),
        }
      : null,
    product.composition
      ? {
          id: 'ingredients',
          label: 'Ingredients',
          content: (
            <div className="max-w-2xl rounded-md border border-gray-200 bg-gray-50 p-5">
              <p className="text-body-sm font-semibold uppercase tracking-[0.045em] text-gray-500">
                Composition
              </p>
              <p className="mt-2 text-body leading-relaxed text-gray-700">{product.composition}</p>
            </div>
          ),
        }
      : null,
    hasWarnings
      ? {
          id: 'warnings',
          label: 'Warnings',
          content: (
            <div className="grid gap-4 lg:grid-cols-2">
              {product.warnings.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-5">
                  <h3 className="flex items-center gap-2 text-body font-semibold text-amber-700">
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Warnings and precautions
                  </h3>
                  <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-body-sm leading-relaxed text-amber-700">
                    {product.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              {product.sideEffects.length > 0 && (
                <div className="rounded-md border border-gray-200 bg-white p-5">
                  <h3 className="text-body font-semibold text-gray-900">Possible side effects</h3>
                  <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-body-sm leading-relaxed text-gray-700">
                    {product.sideEffects.map((effect) => (
                      <li key={effect}>{effect}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ),
        }
      : null,
  ]
  const tabs = allTabs.filter((tab): tab is ProductTab => tab !== null)

  return (
    <div className="container py-8">
      {/* XSS: JSON.stringify alone is NOT safe inside a <script> block. A
          product name containing "</script>" would close the tag early and let
          everything after it execute as markup — and product names are
          admin-editable, so this is reachable. Escaping the three characters
          that can break out of a script context closes it. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026'),
        }}
      />

      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Medical Store', href: '/pharmacy' },
          { label: product.name },
        ]}
      />

      {/* ================= Gallery + buy panel ================= */}
      <div className="grid gap-8 lg:grid-cols-[1fr_440px] lg:gap-12 xl:grid-cols-[1fr_480px]">
        <ProductGallery images={product.images} icon={product.icon} name={product.name} />

        {/* Sticky on desktop so the purchase action tracks the reader down the
            page; self-start is what lets a grid child stick at all. */}
        <div className="self-start lg:sticky lg:top-24">
          <BuyBox product={product} brandName={brandName} />
        </div>
      </div>

      {/* Sentinel drives the mobile sticky bar's visibility. */}
      <div id="buy-box-sentinel" aria-hidden="true" className="h-px" />

      {/* ================= Product information tabs ================= */}
      {tabs.length > 0 && (
        <section className="mt-14" aria-label="Product information">
          <ProductTabs tabs={tabs} />

          <div className="mt-8 flex gap-3 rounded-md border border-gray-200 bg-gray-50 p-4 text-body-sm text-gray-500">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <p>
              This information is for reference only and does not replace advice from your doctor
              or pharmacist. Always read the leaflet inside the pack.
            </p>
          </div>
        </section>
      )}

      {/* Same molecule, different brand. Showing a cheaper equivalent is what
          a pharmacy is supposed to do, and it earns repeat customers. */}
      {generics.length > 0 && (
        <section className="mt-16" aria-labelledby="pdp-generics">
          <div id="pdp-generics">
            <SectionHeading
              title="Same molecule, other brands"
              description={`These contain the same active ingredient — ${product.genericName} — and may cost less.`}
            />
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {generics.map((alt) => (
              <li key={alt.id}>
                <a
                  href={`/products/${alt.slug}`}
                  className="flex items-center gap-4 rounded-md border border-gray-200 bg-white p-4 transition-all duration-medium hover:-translate-y-0.5 hover:border-blue-600/25 hover:shadow-e2"
                >
                  <MediaPlaceholder
                    icon={alt.icon}
                    size="sm"
                    className="h-14 w-14 shrink-0 rounded-sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-semibold text-gray-900">{alt.name}</p>
                    <p className="truncate text-body-sm text-gray-500">
                      {getBrandName(alt.brandId)}
                    </p>
                  </div>
                  <span className="tabular shrink-0 text-body font-bold text-gray-900">
                    {formatPrice(lowestPrice(alt))}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ================= Related products ================= */}
      {related.length > 0 && (
        <section className="mt-16" aria-labelledby="pdp-related">
          <div id="pdp-related">
            <SectionHeading
              title="Frequently bought together"
              description="Often added to the same order"
              href="/pharmacy"
              linkLabel="All medicines"
            />
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}

      <StickyBuyBar product={product} />
    </div>
  )
}
