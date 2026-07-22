import type { Metadata } from 'next'
import Link from 'next/link'
import { HeartPulse } from 'lucide-react'
import { Breadcrumbs, EmptyState } from '@/components/shared/primitives'
import { buttonVariants } from '@/components/ui/button'
import { PackageCard } from '@/features/catalog/components/cards'
import { getHealthPackages } from '@/lib/data/queries'
import { cn } from '@/lib/utils'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Health packages — bundled screening',
  description:
    'Comprehensive health check-up packages with home sample collection. Full body checkup, diabetes screening, and women’s wellness panels.',
}

export default async function HealthPackagesPage() {
  const packages = await getHealthPackages()

  return (
    <div className="container py-8 md:py-12">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Health Packages' }]} />

      <h1 className="text-h1">Health packages</h1>
      <p className="mt-2 max-w-3xl text-body text-gray-500">
        Curated bundles of tests at a lower price than booking each one separately. All packages
        include home sample collection and digital reports.
      </p>

      {packages.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<HeartPulse className="h-10 w-10" />}
            title="No packages available right now"
            description="New screening bundles are added regularly — in the meantime you can book individual lab tests."
            action={
              <Link href="/lab-tests" className={cn(buttonVariants({ variant: 'primary' }))}>
                Browse lab tests
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <p className="mb-6 mt-8 text-body-sm text-gray-500">
            <span className="font-semibold text-gray-900">{packages.length}</span> packages
            available
          </p>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {packages.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} testCount={pkg.includedTestSlugs.length} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
