import Link from 'next/link'
import { Building2, FileUp, FlaskConical, Microscope, Utensils } from 'lucide-react'
import { PageHeader, StatCard, StatusPill } from '@/components/admin/ui'
import { DataTable, type Column } from '@/components/admin/data-table'
import { FilterBar } from '@/components/admin/filter-bar'
import { Pagination } from '@/components/admin/pagination'
import { getAdminLabTests } from '@/lib/data/admin'
import { matchesQuery, paginate, param, parsePage } from '@/lib/data/paginate'
import { formatPrice, turnaroundLabel } from '@/lib/utils'

export const metadata = { title: 'Lab Tests' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>
type Row = Awaited<ReturnType<typeof getAdminLabTests>>[number]

export default async function AdminLabTestsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const adminLabTests = await getAdminLabTests()
  const query = param(params, 'q')
  const lab = param(params, 'lab')
  const fasting = param(params, 'fasting')

  const filtered = adminLabTests.filter((test) => {
    if (!matchesQuery(test, query, ['name', 'shortCode', 'labName'])) return false
    if (lab && test.labName !== lab) return false
    if (fasting === 'yes' && !test.fastingRequired) return false
    if (fasting === 'no' && test.fastingRequired) return false
    return true
  })

  const result = paginate(filtered, parsePage(params.page))
  const labs = Array.from(new Set(adminLabTests.map((t) => t.labName)))

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Test',
      primary: true,
      cell: (test) => (
        <div className="min-w-0">
          <Link
            href={`/lab-tests/${test.slug}`}
            className="block truncate rounded-sm font-semibold text-gray-900 hover:text-blue-600 hover:underline"
          >
            {test.name}
          </Link>
          <p className="truncate text-[12.5px] text-gray-500">
            {test.shortCode} · {test.parameters.length} parameters
          </p>
        </div>
      ),
    },
    { key: 'lab', header: 'Lab', cell: (t) => t.labName },
    { key: 'sample', header: 'Sample', cell: (t) => t.sampleType, hideOnMobile: true },
    {
      key: 'fasting',
      header: 'Fasting',
      cell: (test) =>
        test.fastingRequired ? (
          <StatusPill tone="warning">{test.fastingHours}h fasting</StatusPill>
        ) : (
          <StatusPill tone="success">None</StatusPill>
        ),
    },
    {
      key: 'turnaround',
      header: 'Turnaround',
      hideOnMobile: true,
      cell: (t) => <span className="whitespace-nowrap">{turnaroundLabel(t.turnaroundHours)}</span>,
    },
    {
      key: 'bookings',
      header: 'Bookings',
      align: 'right',
      cell: (t) => <span className="tabular">{t.bookingCount}</span>,
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      cell: (t) => <span className="tabular font-semibold text-gray-900">{formatPrice(t.pricePaisa)}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title="Lab tests"
        description="The diagnostic catalog. Price is per lab, so the same test can differ between partners."
        action={
          // Tests are created and updated through the Excel import (upsert by
          // test_code) — this is the real affordance, not a dead button.
          <Link
            href="/admin/imports"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-[13.5px] font-semibold text-white shadow-e1 transition-all duration-medium hover:bg-blue-700 hover:shadow-e2"
          >
            <FileUp className="h-4 w-4" aria-hidden="true" />
            Add / update via Excel
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Tests" icon={FlaskConical} value={String(adminLabTests.length)} />
        <StatCard label="Partner labs" icon={Building2} value={String(labs.length)} />
        <StatCard
          label="Fasting required" icon={Utensils}
          value={String(adminLabTests.filter((t) => t.fastingRequired).length)}
        />
        <StatCard
          label="Total bookings" icon={Microscope}
          value={String(adminLabTests.reduce((sum, t) => sum + t.bookingCount, 0))}
        />
      </div>

      <FilterBar
        searchPlaceholder="Search test name or code…"
        selects={[
          { key: 'lab', label: 'Lab', options: labs.map((l) => ({ value: l, label: l })) },
          {
            key: 'fasting',
            label: 'Fasting',
            options: [
              { value: 'yes', label: 'Required' },
              { value: 'no', label: 'Not required' },
            ],
          },
        ]}
      />

      <DataTable columns={columns} rows={result.rows} rowKey={(t) => t.id} caption="Lab tests" />
      <Pagination result={result} searchParams={params} basePath="/admin/lab-tests" />
    </>
  )
}
