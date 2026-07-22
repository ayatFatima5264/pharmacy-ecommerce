import 'server-only'
import { cache } from 'react'
import { supabaseService } from '@/lib/supabase/server'
import { DEFAULT_ICONS } from '@/config/icons'
import {
  healthPackages as scaffoldPackages,
  labTests as scaffoldTests,
} from '@/lib/data/catalog'
import type { HealthPackage, LabTest } from '@/types'

/**
 * Lab catalog reads, database-backed — the last storefront surface to flip
 * (Step 8). Same domain shapes, same content-overlay rule as the pharmacy
 * side: prices, availability, and clinical scheduling facts come from the
 * database; editorial content the schema deliberately doesn't model yet
 * (parameters, who-should-take, sale compare-at, emoji icons) overlays from
 * the scaffold BY SLUG, with safe fallbacks for imported tests.
 */

const testOverlay = new Map(scaffoldTests.map((t) => [t.slug, t]))
const packageOverlay = new Map(scaffoldPackages.map((p) => [p.slug, p]))

export const getLabTestsDb = cache(async (): Promise<LabTest[]> => {
  const { data, error } = await supabaseService()
    .from('lab_tests')
    .select(
      `id, slug, name, short_code, description, sample_type, fasting_required,
       fasting_hours, turnaround_hours,
       lab_test_pricing ( price_paisa, home_collection_fee_paisa, is_available, labs ( name, is_active ) )`,
    )
    .eq('is_active', true)
    .order('name')
  if (error) throw new Error(`lab_tests query failed: ${error.message}`)

  return (
    (data ?? []) as unknown as {
      id: string
      slug: string
      name: string
      short_code: string | null
      description: string | null
      sample_type: string
      fasting_required: boolean
      fasting_hours: number | null
      turnaround_hours: number
      lab_test_pricing: {
        price_paisa: number
        home_collection_fee_paisa: number
        is_available: boolean
        labs: { name: string; is_active: boolean } | null
      }[]
    }[]
  )
    .map((t) => {
      const pricing = t.lab_test_pricing.find((p) => p.is_available && p.labs?.is_active !== false)
      if (!pricing) return null // a test no lab offers is not sellable
      const overlay = testOverlay.get(t.slug)
      return {
        id: t.id,
        slug: t.slug,
        name: t.name,
        shortCode: t.short_code ?? t.name.slice(0, 6).toUpperCase(),
        description: t.description ?? overlay?.description ?? '',
        sampleType: t.sample_type,
        fastingRequired: t.fasting_required,
        fastingHours: t.fasting_hours,
        turnaroundHours: t.turnaround_hours,
        pricePaisa: pricing.price_paisa,
        compareAtPricePaisa: overlay?.compareAtPricePaisa ?? null,
        homeCollectionFeePaisa: pricing.home_collection_fee_paisa,
        labName: pricing.labs?.name ?? 'Partner lab',
        parameters: overlay?.parameters ?? [],
        whoShouldTake: overlay?.whoShouldTake ?? [],
      } satisfies LabTest
    })
    .filter((t): t is LabTest => t !== null)
})

export const getHealthPackagesDb = cache(async (): Promise<HealthPackage[]> => {
  const { data, error } = await supabaseService()
    .from('health_packages')
    .select(
      `id, slug, name, description, price_paisa, compare_at_price_paisa,
       fasting_required, turnaround_hours,
       labs ( name ),
       health_package_tests ( lab_tests ( slug ) )`,
    )
    .eq('is_active', true)
    .order('name')
  if (error) throw new Error(`health_packages query failed: ${error.message}`)

  return (
    (data ?? []) as unknown as {
      id: string
      slug: string
      name: string
      description: string | null
      price_paisa: number
      compare_at_price_paisa: number | null
      fasting_required: boolean
      turnaround_hours: number
      labs: { name: string } | null
      health_package_tests: { lab_tests: { slug: string } | null }[]
    }[]
  ).map((p) => {
    const overlay = packageOverlay.get(p.slug)
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description ?? overlay?.description ?? '',
      icon: overlay?.icon ?? DEFAULT_ICONS.package,
      pricePaisa: p.price_paisa,
      compareAtPricePaisa: p.compare_at_price_paisa,
      fastingRequired: p.fasting_required,
      turnaroundHours: p.turnaround_hours,
      labName: p.labs?.name ?? 'Partner lab',
      suitableFor: overlay?.suitableFor ?? 'Everyone',
      includedTestSlugs: p.health_package_tests
        .map((m) => m.lab_tests?.slug)
        .filter((slug): slug is string => Boolean(slug)),
    } satisfies HealthPackage
  })
})
