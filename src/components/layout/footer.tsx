import Image from 'next/image'
import Link from 'next/link'
import { Mail, MapPin, Phone, ShieldCheck } from 'lucide-react'
import { footerNav, siteConfig } from '@/config/site'

export function Footer() {
  return (
    <footer className="mt-20 border-t border-gray-200 bg-white">
      <div className="container py-16">
        <div className="grid gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-6">
          <div className="md:col-span-2 lg:col-span-2">
            <Link href="/" className="flex w-fit items-center gap-2.5 rounded-sm">
              <Image
                src={siteConfig.logo}
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 rounded-md object-contain"
              />
              <span className="text-[18px] font-bold tracking-[-0.015em] text-gray-900">
                {siteConfig.name}
              </span>
            </Link>
            <p className="mt-2 text-[13.5px] font-semibold text-blue-600">{siteConfig.tagline}</p>
            <p className="mt-3 max-w-sm text-body-sm leading-relaxed text-gray-500">
              {siteConfig.description}
            </p>

            <ul className="mt-6 flex flex-col gap-3 text-body-sm text-gray-600">
              <li className="flex items-start gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-blue-600/70" aria-hidden="true" />
                <a href={`tel:${siteConfig.phone.replace(/\s/g, '')}`} className="rounded-sm hover:text-blue-600">
                  {siteConfig.phone}
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-blue-600/70" aria-hidden="true" />
                <a href={`mailto:${siteConfig.email}`} className="rounded-sm hover:text-blue-600">
                  {siteConfig.email}
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600/70" aria-hidden="true" />
                {siteConfig.address}
              </li>
            </ul>
          </div>

          {footerNav.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-gray-900">
                {group.title}
              </h2>
              <ul className="mt-5 flex flex-col gap-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="rounded-sm text-body-sm text-gray-500 transition-colors duration-fast hover:text-blue-600"
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
        <div className="mt-14 flex flex-col gap-4 rounded-md border border-gray-200 bg-gray-50 px-6 py-5 text-body-sm text-gray-600 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2 font-semibold text-green-700">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              DRAP Licence {siteConfig.drapLicense}
            </span>
            <span>Superintendent pharmacist: {siteConfig.pharmacist}</span>
          </div>
          <span className="text-gray-500 md:text-right">Cash on delivery · JazzCash · Easypaisa</span>
        </div>
      </div>

      <div className="border-t border-gray-200">
        <div className="container flex flex-col items-center justify-between gap-2 py-5 text-[12.5px] text-gray-500 sm:flex-row">
          <span>© {new Date().getFullYear()} {siteConfig.name}. All rights reserved.</span>
          <span>{siteConfig.hours}</span>
        </div>
      </div>
    </footer>
  )
}
