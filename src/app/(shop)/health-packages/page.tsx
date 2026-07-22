import type { Metadata } from 'next'
import { Breadcrumbs } from '@/components/shared/primitives'
import { PackageCard } from '@/features/catalog/components/cards'
import { getHealthPackages } from '@/lib/data/queries'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Health packages — bundled screening',
  description:
    'Comprehensive health check-up packages with home sample collection. Full body checkup, diabetes screening, and women’s wellness panels.',
}

export default async function HealthPackagesPage() {
  const packages = await getHealthPackages()

  return (
    <div className="container py-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Health Packages' }]} />

      <h1 className="text-h1">Health packages</h1>
      <p className="mt-2 max-w-2xl text-body text-gray-500">
        Curated bundles of tests at a lower price than booking each one separately. All packages
        include home sample collection and digital reports.
      </p>

      <p className="mb-6 mt-8 text-body-sm text-gray-500">{packages.length} packages available</p>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} testCount={pkg.includedTestSlugs.length} />
        ))}
      </div>
    </div>
  )
}
