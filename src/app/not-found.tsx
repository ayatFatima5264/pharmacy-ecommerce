import Link from 'next/link'
import { Compass } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const suggestions = [
  { label: 'Pharmacy', href: '/pharmacy' },
  { label: 'Lab tests', href: '/lab-tests' },
  { label: 'Health packages', href: '/health-packages' },
  { label: 'Track an order', href: '/track-order' },
]

export default function NotFound() {
  return (
    <div className="container flex max-w-lg flex-col items-center py-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-50 text-gray-400">
        <Compass className="h-8 w-8" aria-hidden="true" />
      </span>

      <p className="tabular mt-6 text-caption uppercase tracking-[0.1em] text-gray-500">
        Error 404
      </p>
      <h1 className="mt-2 text-h1">We could not find that page</h1>
      <p className="mt-3 text-body text-gray-500">
        The link may be out of date, or the product may no longer be listed. Here is where most
        people go next.
      </p>

      <ul className="mt-8 flex flex-wrap justify-center gap-2.5">
        {suggestions.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className={cn(buttonVariants({ variant: 'outline' }))}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      <Link href="/" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'mt-8')}>
        Back to home
      </Link>
    </div>
  )
}
