/**
 * Security headers.
 *
 * Each header below closes a specific attack; the comment says which. Headers
 * are defence in depth — they do not replace escaping or validation, they limit
 * the blast radius when something else goes wrong.
 */
const securityHeaders = [
  // Stops a browser second-guessing Content-Type. Without it, a text file that
  // happens to contain script can be sniffed and executed as JavaScript.
  { key: 'X-Content-Type-Options', value: 'nosniff' },

  // Clickjacking: nobody may frame this site, so an invisible overlay cannot
  // trick a signed-in admin into clicking a real button.
  { key: 'X-Frame-Options', value: 'DENY' },

  // Referrer leakage: full URLs (which can carry order numbers) are never sent
  // to third-party origins.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

  // Least privilege for device APIs. Camera stays enabled for prescription
  // photo capture; everything else is off.
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },

  // Forces HTTPS for two years, including subdomains. Only meaningful in
  // production, where TLS actually terminates.
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
]

/**
 * Content Security Policy — the main XSS mitigation.
 *
 * 'unsafe-inline' for styles is required by Tailwind's runtime style injection
 * and by next/font. Script is NOT given unsafe-inline in production.
 *
 * 'unsafe-eval' is dev-only: React Refresh needs it. Shipping it to production
 * would hand any injected string a working eval().
 */
const csp = [
  "default-src 'self'",
  process.env.NODE_ENV === 'production'
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // No third-party endpoints are called from the browser, so nothing else is
  // allowed to be — this is what stops an injected script phoning home.
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(process.env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
].join('; ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hides the framework version from attackers fingerprinting for known CVEs.
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [...securityHeaders, { key: 'Content-Security-Policy', value: csp }],
      },
    ]
  },
}

export default nextConfig
