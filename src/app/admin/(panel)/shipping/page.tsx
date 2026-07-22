import { Plus } from 'lucide-react'
import { PageHeader, StatCard, StatusPill } from '@/components/admin/ui'
import { DataTable, type Column } from '@/components/admin/data-table'
import { FilterBar } from '@/components/admin/filter-bar'
import { Pagination } from '@/components/admin/pagination'
import { Button } from '@/components/ui/button'
import { getAdminShippingZones, type AdminShippingZone } from '@/lib/data/admin'
import { matchesQuery, paginate, param, parsePage } from '@/lib/data/paginate'
import { formatPrice } from '@/lib/utils'

export const metadata = { title: 'Shipping' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AdminShippingPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const adminShippingZones = await getAdminShippingZones()
  const query = param(params, 'q')
  const carrier = param(params, 'carrier')
  const cod = param(params, 'cod')

  const filtered = adminShippingZones.filter((zone) => {
    const haystack = { ...zone, cityList: zone.cities.join(' ') }
    if (!matchesQuery(haystack, query, ['name', 'carrier', 'cityList'])) return false
    if (carrier && zone.carrier !== carrier) return false
    if (cod === 'yes' && !zone.supportsCod) return false
    if (cod === 'no' && zone.supportsCod) return false
    return true
  })

  const result = paginate(filtered, parsePage(params.page))
  const carriers = Array.from(new Set(adminShippingZones.map((z) => z.carrier)))

  const columns: Column<AdminShippingZone>[] = [
    {
      key: 'zone',
      header: 'Zone',
      primary: true,
      cell: (zone) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{zone.name}</p>
          <p className="truncate text-[12.5px] text-gray-500">{zone.cities.join(', ')}</p>
        </div>
      ),
    },
    { key: 'carrier', header: 'Carrier', cell: (z) => z.carrier },
    {
      key: 'eta',
      header: 'Delivery time',
      cell: (zone) => (
        <span className="tabular whitespace-nowrap">
          {zone.minDays === 0 ? 'Same day' : `${zone.minDays}–${zone.maxDays} days`}
        </span>
      ),
    },
    {
      key: 'rate',
      header: 'Rate',
      align: 'right',
      cell: (z) => <span className="tabular font-semibold text-gray-900">{formatPrice(z.ratePaisa)}</span>,
    },
    {
      key: 'free',
      header: 'Free above',
      align: 'right',
      hideOnMobile: true,
      cell: (zone) =>
        zone.freeAbovePaisa ? (
          <span className="tabular">{formatPrice(zone.freeAbovePaisa)}</span>
        ) : (
          <span className="text-gray-400">Never</span>
        ),
    },
    {
      key: 'cod',
      header: 'COD',
      cell: (zone) =>
        // COD support is not cosmetic — it decides whether a zone is even
        // orderable for most of this market.
        zone.supportsCod ? (
          <StatusPill tone="success">Supported</StatusPill>
        ) : (
          <StatusPill tone="danger">Prepaid only</StatusPill>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (zone) =>
        zone.isActive ? (
          <StatusPill tone="success">Active</StatusPill>
        ) : (
          <StatusPill tone="neutral">Disabled</StatusPill>
        ),
    },
  ]

  const noCod = adminShippingZones.filter((z) => !z.supportsCod).length

  return (
    <>
      <PageHeader
        title="Shipping"
        description="Delivery zones and rate cards. Rates are data, not code — courier tariffs change often."
        action={
          <Button size="sm">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add zone
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Zones" value={String(adminShippingZones.length)} />
        <StatCard
          label="Active"
          value={String(adminShippingZones.filter((z) => z.isActive).length)}
          tone="success"
        />
        <StatCard
          label="Cities covered"
          value={String(new Set(adminShippingZones.flatMap((z) => z.cities)).size)}
        />
        <StatCard label="No COD" value={String(noCod)} tone={noCod > 0 ? 'warning' : 'neutral'} />
      </div>

      <FilterBar
        searchPlaceholder="Search zone, carrier, city…"
        selects={[
          { key: 'carrier', label: 'Carrier', options: carriers.map((c) => ({ value: c, label: c })) },
          {
            key: 'cod',
            label: 'COD',
            options: [
              { value: 'yes', label: 'Supported' },
              { value: 'no', label: 'Prepaid only' },
            ],
          },
        ]}
      />

      <DataTable columns={columns} rows={result.rows} rowKey={(z) => z.id} caption="Shipping zones" />
      <Pagination result={result} searchParams={params} basePath="/admin/shipping" />
    </>
  )
}
