import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/globals.css'
import { siteConfig } from '@/config/site'

// next/font self-hosts and inlines the CSS at build time — no runtime request
// to a font CDN, which would otherwise cost ~300ms of LCP on 4G.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [
    'online pharmacy Lahore',
    'medicine delivery Lahore',
    'lab tests Lahore',
    'health packages',
    'medical store',
    'DRAP licensed pharmacy',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_PK',
    url: '/',
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: [{ url: siteConfig.logo, width: 512, height: 512, alt: siteConfig.name }],
  },
  twitter: {
    card: 'summary',
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: [siteConfig.logo],
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#0f766e',
  width: 'device-width',
  initialScale: 1,
}

/**
 * The root layout owns only <html>/<body> and the font.
 *
 * The storefront chrome (header, footer, cart) lives in the storefront group
 * layouts, and the admin console has its own shell. Keeping them apart is what
 * stops admin routes shipping the cart provider and store navigation they will
 * never use.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
