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
      className="flex w-full max-w-xl flex-col gap-3 sm:flex-row"
    >
      <div className="relative flex-1">
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
          className="h-13 w-full rounded-md border border-gray-200 bg-white pl-12 pr-4 text-base text-gray-900 shadow-e1 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-[3px] focus:ring-blue-100"
        />
      </div>
      <Button type="submit" size="lg" className="sm:w-auto">
        Search
      </Button>
    </form>
  )
}
