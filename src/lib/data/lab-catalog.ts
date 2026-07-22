import { healthPackages, labTests } from './catalog'
import type { HealthPackage, LabTest } from '@/types'

/**
 * Diagnostic taxonomy.
 *
 * Lab tests get their OWN categories, not the pharmacy ones. "Antibiotics" is
 * meaningless for a blood panel, and forcing both into one tree would make
 * either the medicine or the diagnostics navigation nonsense.
 */

export interface LabCategory {
  slug: string
  name: string
  icon: string
  description: string
}

export const labCategories: LabCategory[] = [
  {
    slug: 'general-health',
    name: 'General Health',
    icon: '🩺',
    description: 'Routine screening panels that give a broad picture of how you are doing.',
  },
  {
    slug: 'diabetes',
    name: 'Diabetes',
    icon: '🩸',
    description: 'Blood sugar control, both right now and averaged over recent months.',
  },
  {
    slug: 'heart-health',
    name: 'Heart Health',
    icon: '❤️',
    description: 'Cholesterol and lipid markers used to assess cardiovascular risk.',
  },
  {
    slug: 'hormones',
    name: 'Hormones & Thyroid',
    icon: '⚖️',
    description: 'Thyroid function and hormone levels — commonly missed, easily treated.',
  },
  {
    slug: 'vitamins',
    name: 'Vitamins & Minerals',
    icon: '☀️',
    description: 'Deficiency testing. Vitamin D deficiency is very common in Pakistan.',
  },
  {
    slug: 'organ-function',
    name: 'Liver & Kidney',
    icon: '🫁',
    description: 'Panels showing how well your liver and kidneys are filtering and functioning.',
  },
  {
    slug: 'infections',
    name: 'Infections',
    icon: '🦠',
    description: 'Screening for hepatitis and other infections that often show no symptoms.',
  },
]

/**
 * test slug → category slug.
 *
 * Stands in for `lab_tests.category_id`. Keeping it as an explicit map rather
 * than guessing from the name means a retitled test never silently changes
 * category.
 */
const TEST_CATEGORY: Record<string, string> = {
  'complete-blood-count': 'general-health',
  hba1c: 'diabetes',
  'lipid-profile': 'heart-health',
  'thyroid-profile': 'hormones',
  'vitamin-d-test': 'vitamins',
  'liver-function-test': 'organ-function',
  'kidney-function-test': 'organ-function',
  'hepatitis-b-c-screening': 'infections',
}

export interface LabTestWithCategory extends LabTest {
  categorySlug: string
  categoryName: string
}

export function getLabTestsWithCategory(): LabTestWithCategory[] {
  return labTests.map((test) => {
    const slug = TEST_CATEGORY[test.slug] ?? 'general-health'
    return {
      ...test,
      categorySlug: slug,
      categoryName: labCategories.find((c) => c.slug === slug)?.name ?? 'General Health',
    }
  })
}

export function getLabCategoryBySlug(slug: string): LabCategory | null {
  return labCategories.find((c) => c.slug === slug) ?? null
}

export function getLabTestsInCategory(slug: string): LabTestWithCategory[] {
  return getLabTestsWithCategory().filter((test) => test.categorySlug === slug)
}

export function countTestsPerCategory(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const test of getLabTestsWithCategory()) {
    counts[test.categorySlug] = (counts[test.categorySlug] ?? 0) + 1
  }
  return counts
}

export function getLabTestBySlug(slug: string): LabTestWithCategory | null {
  return getLabTestsWithCategory().find((t) => t.slug === slug) ?? null
}

export function getPackageBySlug(slug: string): HealthPackage | null {
  return healthPackages.find((p) => p.slug === slug) ?? null
}

/** Expands a package into the tests the lab actually runs. */
export function expandPackage(pkg: HealthPackage): LabTestWithCategory[] {
  const all = getLabTestsWithCategory()
  return pkg.includedTestSlugs
    .map((slug) => all.find((t) => t.slug === slug))
    .filter((t): t is LabTestWithCategory => Boolean(t))
}

/** Longest fasting requirement across a set of tests drives the whole visit. */
export function fastingHoursFor(tests: LabTest[]): number | null {
  const hours = tests.filter((t) => t.fastingRequired).map((t) => t.fastingHours ?? 8)
  return hours.length > 0 ? Math.max(...hours) : null
}
