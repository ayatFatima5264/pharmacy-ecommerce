/**
 * Verification for the lab test module.
 * Run with: npm run check:lab
 */
import { labBookingSchema } from '../src/features/lab/schemas/booking-schema'
import {
  countTestsPerCategory,
  expandPackage,
  fastingHoursFor,
  getLabTestBySlug,
  getLabTestsInCategory,
  getLabTestsWithCategory,
  getPackageBySlug,
  labCategories,
} from '../src/lib/data/lab-catalog'
import {
  SLOT_TEMPLATES,
  getAvailableDates,
  getSlotsForDate,
  isSlotBookable,
  releaseSlot,
  reserveSlot,
  supportsHomeCollection,
} from '../src/lib/data/lab-store'

async function main() {
let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail = '') {
  if (condition) { passed++; console.log(`  PASS  ${name}`) }
  else { failed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}

console.log('\nCategories')
{
  const tests = await getLabTestsWithCategory()
  check('every test has a category', tests.every((t) => t.categorySlug && t.categoryName))
  check('every category slug is real',
    tests.every((t) => labCategories.some((c) => c.slug === t.categorySlug)))

  const counts = await countTestsPerCategory()
  check('category counts sum to the test total',
    Object.values(counts).reduce((a, b) => a + b, 0) === tests.length)

  check('HbA1c is filed under diabetes', (await getLabTestBySlug('hba1c'))?.categorySlug === 'diabetes')
  check('LFT and RFT share the organ-function category',
    (await getLabTestsInCategory('organ-function')).length === 2)
  check('unknown category yields no tests', (await getLabTestsInCategory('nonsense')).length === 0)
}

console.log('\nPackages')
{
  const pkg = await getPackageBySlug('full-body-checkup')
  check('package resolves', pkg !== null)

  const tests = pkg ? await expandPackage(pkg) : []
  check('package expands into its member tests', tests.length === 6, String(tests.length))
  check('expanded tests are real test records', tests.every((t) => t.slug && t.name))

  // A package is priced below the sum of its parts — that saving is the product.
  const individual = tests.reduce((sum, t) => sum + t.pricePaisa, 0)
  check('package costs less than its tests bought separately',
    pkg !== null && pkg.pricePaisa < individual,
    `pkg ${pkg?.pricePaisa} vs sum ${individual}`)

  check('unknown package resolves to null', (await getPackageBySlug('nope')) === null)
}

console.log('\nFasting rules')
{
  const lipid = (await getLabTestBySlug('lipid-profile'))!   // 12h
  const lft = (await getLabTestBySlug('liver-function-test'))! // 8h
  const cbc = (await getLabTestBySlug('complete-blood-count'))! // none

  check('no fasting needed for non-fasting tests', fastingHoursFor([cbc]) === null)
  check('single fasting test returns its own hours', fastingHoursFor([lft]) === 8)
  // The strictest requirement governs the whole visit — one sample draw.
  check('mixed set takes the LONGEST fasting requirement',
    fastingHoursFor([cbc, lft, lipid]) === 12, String(fastingHoursFor([cbc, lft, lipid])))
}

console.log('\nAvailable dates')
{
  const dates = getAvailableDates('Karachi')
  check('dates are offered', dates.length > 0)
  check('at most 10 days offered', dates.length <= 10)
  check('dates are ISO formatted', dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date)))
  check('dates are in ascending order',
    dates.every((d, i) => i === 0 || d.date > dates[i - 1].date))
  check('every offered date has remaining capacity', dates.every((d) => d.slotsRemaining > 0))
}

console.log('\nSlot capacity')
{
  const date = getAvailableDates('Quetta')[0].date
  const before = getSlotsForDate('Quetta', date)
  const target = before.find((s) => !s.isFull && !s.isPast)!

  check('Quetta has small capacity (2 phlebotomists)', target.capacity === 2, String(target.capacity))

  const first = reserveSlot('Quetta', date, target.id)
  check('first booking succeeds', first.ok)

  const after = getSlotsForDate('Quetta', date).find((s) => s.id === target.id)!
  check('reserving decrements remaining capacity',
    after.remaining === target.remaining - 1, `${target.remaining} → ${after.remaining}`)

  const second = reserveSlot('Quetta', date, target.id)
  check('second booking succeeds (capacity 2)', second.ok)

  // The whole point of modelling capacity: the third must be refused.
  const third = reserveSlot('Quetta', date, target.id)
  check('booking beyond capacity is REFUSED', !third.ok)
  check('refusal explains why', !third.ok && third.reason.includes('full'))

  const full = getSlotsForDate('Quetta', date).find((s) => s.id === target.id)!
  check('slot now reports as full', full.isFull && full.remaining === 0)

  releaseSlot('Quetta', date, target.id)
  const released = getSlotsForDate('Quetta', date).find((s) => s.id === target.id)!
  check('releasing gives capacity back', released.remaining === 1, String(released.remaining))
  check('released slot is bookable again', isSlotBookable('Quetta', date, target.id).ok)
}

console.log('\nSlot validation')
{
  const date = getAvailableDates('Lahore')[0].date
  check('unknown slot id refused', !isSlotBookable('Lahore', date, 'not-a-slot').ok)

  // A slot on a past date must never be bookable.
  const past = isSlotBookable('Lahore', '2020-01-01', SLOT_TEMPLATES[0].id)
  check('slot on a past date refused', !past.ok)

  const lateEvening = new Date()
  lateEvening.setHours(23, 0, 0, 0)
  const today = lateEvening.toISOString().slice(0, 10)
  const slots = getSlotsForDate('Lahore', today, lateEvening)
  check('late at night, every slot today has passed', slots.every((s) => s.isPast))
}

console.log('\nHome collection coverage')
{
  check('Karachi supports home collection', supportsHomeCollection('Karachi'))
  check('Gilgit does not', !supportsHomeCollection('Gilgit'))
}

console.log('\nPatient details validation')
{
  const valid = {
    patientName: 'Fatima Khan',
    patientAge: '34',
    patientGender: 'female',
    patientPhone: '03001234567',
    collectionMode: 'home',
    slotDate: '2026-08-01',
    slotId: 'morning',
  }
  check('valid booking accepted', labBookingSchema.safeParse(valid).success)

  for (const field of ['patientName', 'patientAge', 'patientGender', 'patientPhone', 'slotId'] as const) {
    check(`missing ${field} rejected`,
      !labBookingSchema.safeParse({ ...valid, [field]: '' }).success)
  }

  check('age above 120 rejected',
    !labBookingSchema.safeParse({ ...valid, patientAge: '150' }).success)
  check('non-numeric age rejected',
    !labBookingSchema.safeParse({ ...valid, patientAge: 'thirty' }).success)
  check('newborn age 0 accepted',
    labBookingSchema.safeParse({ ...valid, patientAge: '0' }).success)
  check('age is parsed to a number',
    labBookingSchema.safeParse(valid).success &&
      labBookingSchema.parse(valid).patientAge === 34)

  check('invalid phone rejected',
    !labBookingSchema.safeParse({ ...valid, patientPhone: '12345' }).success)
  check('malformed date rejected',
    !labBookingSchema.safeParse({ ...valid, slotDate: '01/08/2026' }).success)
  check('unknown gender rejected',
    !labBookingSchema.safeParse({ ...valid, patientGender: 'unknown' }).success)
  check('lab visit mode accepted',
    labBookingSchema.safeParse({ ...valid, collectionMode: 'lab_visit' }).success)
}

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
}
main()
