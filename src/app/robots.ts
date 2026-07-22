import type { MetadataRoute } from 'next'
import { siteConfig } from '@/config/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Transactional and personalised routes carry no SEO value and would
      // waste crawl budget.
      disallow: ['/cart', '/checkout', '/search', '/track-order'],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  }
}
