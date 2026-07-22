import Link from 'next/link'
import { Mail, MapPin, Phone, ShieldCheck } from 'lucide-react'
import { footerNav, siteConfig } from '@/config/site'

export function Footer() {
  return (
    <footer className="mt-20 border-t border-gray-200 bg-gray-50">
      <div className="container py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="flex w-fit items-center gap-2 rounded-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-base font-bold text-white">
                S
              </span>
              <span className="text-[17px] font-bold tracking-[-0.015em] text-gray-900">
                {siteConfig.name}
              </span>
            </Link>
            <p className="mt-3.5 max-w-sm text-body-sm text-gray-500">{siteConfig.description}</p>

            <ul className="mt-5 flex flex-col gap-2.5 text-body-sm text-gray-500">
              <li className="flex items-start gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                <a href={`tel:${siteConfig.phone.replace(/\s/g, '')}`} className="rounded-sm hover:text-blue-600">
                  {siteConfig.phone}
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                <a href={`mailto:${siteConfig.email}`} className="rounded-sm hover:text-blue-600">
                  {siteConfig.email}
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                {siteConfig.address}
              </li>
            </ul>
          </div>

          {footerNav.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="text-caption uppercase tracking-[0.06em] text-gray-900">{group.title}</h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="rounded-sm text-body-sm text-gray-500 hover:text-blue-600 hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Licence and named pharmacist are credibility anchors, not legal
            boilerplate — they belong where people look for reassurance. */}
        <div className="mt-12 flex flex-col gap-4 border-t border-gray-200 pt-7 text-body-sm text-gray-500 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2 font-semibold text-green-700">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              DRAP Licence {siteConfig.drapLicense}
            </span>
            <span>Superintendent pharmacist: {siteConfig.pharmacist}</span>
          </div>
          <div className="flex flex-col gap-1.5 md:items-end">
            <span>Cash on delivery · JazzCash · Easypaisa</span>
            <span>© {new Date().getFullYear()} {siteConfig.name}. All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
