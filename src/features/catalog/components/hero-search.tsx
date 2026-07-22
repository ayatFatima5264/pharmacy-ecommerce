'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function HeroSearch() {
  const router = useRouter()
  const [query, setQuery] = React.useState('')

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`)
      }}
      className="w-full max-w-xl"
    >
      {/* Premium pill: one white surface with the submit button living inside
          it, so the whole control reads as a single object. */}
      <div className="relative flex items-center rounded-lg bg-white shadow-e2 ring-1 ring-gray-200 transition-shadow duration-fast focus-within:ring-2 focus-within:ring-blue-600">
        <label htmlFor="hero-search" className="sr-only">
          Search medicines or lab tests
        </label>
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <input
          id="hero-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search medicines or lab tests…"
          className="h-14 w-full rounded-lg border-0 bg-transparent pl-12 pr-[7.5rem] text-base text-gray-900 placeholder:text-gray-400 focus:outline-none"
        />
        <Button
          type="submit"
          size="sm"
          className="absolute right-2 top-1/2 h-10 -translate-y-1/2 gap-1.5 px-4"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Search
        </Button>
      </div>
    </form>
  )
}
