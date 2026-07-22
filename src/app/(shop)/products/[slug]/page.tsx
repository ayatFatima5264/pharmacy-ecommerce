import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { Accordion, AccordionItem } from '@/components/ui/accordion'
import { Breadcrumbs, MediaPlaceholder, SectionHeading } from '@/components/shared/primitives'
import { BuyBox, StickyBuyBar } from '@/features/catalog/components/buy-box'
import { ProductCard } from '@/features/catalog/components/cards'
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
          { label: 'Pharmacy', href: '/pharmacy' },
          { label: product.name },
        ]}
      />

      <div className="grid gap-10 lg:grid-cols-[55fr_45fr] lg:gap-14">
        <div>
          <MediaPlaceholder
            icon={product.icon}
            size="lg"
            className="aspect-square rounded-lg border border-gray-200"
          />
        </div>

        <div>
          <BuyBox product={product} brandName={brandName} />
        </div>
      </div>

      {/* Sentinel drives the mobile sticky bar's visibility. */}
      <div id="buy-box-sentinel" aria-hidden="true" className="h-px" />

      <div className="mt-14 grid gap-10 lg:grid-cols-[55fr_45fr] lg:gap-14">
        <div>
          <h2 className="mb-4 text-h2">Product details</h2>
          <p className="text-body text-gray-700">{product.description}</p>

          <Accordion className="mt-7">
            {product.composition && (
              <AccordionItem title="Composition" defaultOpen>
                <p>{product.composition}</p>
                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-body-sm">
                  {product.dosageForm && (
                    <div>
                      <dt className="text-gray-500">Form</dt>
                      <dd className="font-semibold text-gray-900">{product.dosageForm}</dd>
                    </div>
                  )}
                  {product.strength && (
                    <div>
                      <dt className="text-gray-500">Strength</dt>
                      <dd className="font-semibold text-gray-900">{product.strength}</dd>
                    </div>
                  )}
                </dl>
              </AccordionItem>
            )}

            {product.sideEffects.length > 0 && (
              <AccordionItem title="Possible side effects">
                <ul className="flex list-disc flex-col gap-1.5 pl-5">
                  {product.sideEffects.map((effect) => (
                    <li key={effect}>{effect}</li>
                  ))}
                </ul>
              </AccordionItem>
            )}

            {product.warnings.length > 0 && (
              <AccordionItem title="Warnings and precautions">
                <ul className="flex list-disc flex-col gap-1.5 pl-5">
                  {product.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </AccordionItem>
            )}

            {product.storageInstructions && (
              <AccordionItem title="Storage">
                <p>{product.storageInstructions}</p>
              </AccordionItem>
            )}
          </Accordion>

          <div className="mt-6 flex gap-3 rounded-md border border-gray-200 bg-gray-50 p-4 text-body-sm text-gray-500">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <p>
              This information is for reference only and does not replace advice from your doctor
              or pharmacist. Always read the leaflet inside the pack.
            </p>
          </div>
        </div>

        {/* Same molecule, different brand. Showing a cheaper equivalent is what
            a pharmacy is supposed to do, and it earns repeat customers. */}
        {generics.length > 0 && (
          <aside>
            <h2 className="mb-2 text-h2">Same molecule</h2>
            <p className="mb-5 text-body-sm text-gray-500">
              These contain the same active ingredient — {product.genericName} — and may cost less.
            </p>
            <ul className="flex flex-col gap-3">
              {generics.map((alt) => (
                <li key={alt.id}>
                  <a
                    href={`/products/${alt.slug}`}
                    className="flex items-center gap-4 rounded-md border border-gray-200 p-3.5 transition-shadow duration-fast hover:shadow-e1"
                  >
                    <MediaPlaceholder icon={alt.icon} size="sm" className="h-14 w-14 rounded-sm" />
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
          </aside>
        )}
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <SectionHeading title="Frequently bought together" />
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
