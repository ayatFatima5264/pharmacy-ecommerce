import type { MetadataRoute } from 'next'
import { getCategories, getHealthPackages, getLabTests, getProducts } from '@/lib/data/queries'
import { siteConfig } from '@/config/site'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url
  const [products, categories, tests, packages] = await Promise.all([
    getProducts(),
    getCategories(),
    getLabTests(),
    getHealthPackages(),
  ])

  const staticRoutes = ['', '/pharmacy', '/lab-tests', '/health-packages', '/about', '/contact', '/track-order']

  return [
    ...staticRoutes.map((route) => ({
      url: `${base}${route}`,
      changeFrequency: 'daily' as const,
      priority: route === '' ? 1 : 0.8,
    })),
    ...categories.map((c) => ({
      url: `${base}/categories/${c.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...products.map((p) => ({
      url: `${base}/products/${p.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...tests.map((t) => ({
      url: `${base}/lab-tests/${t.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...packages.map((p) => ({
      url: `${base}/health-packages/${p.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ]
}
