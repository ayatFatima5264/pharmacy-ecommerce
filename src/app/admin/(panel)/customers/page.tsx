import Link from 'next/link'
import { PageHeader, StatCard, StatusPill } from '@/components/admin/ui'
import { DataTable, type Column } from '@/components/admin/data-table'
import { FilterBar } from '@/components/admin/filter-bar'
import { Pagination } from '@/components/admin/pagination'
import { getAdminCustomers, type AdminCustomer } from '@/lib/data/admin'
import { matchesQuery, paginate, param, parsePage } from '@/lib/data/paginate'
import { formatDate, formatPrice } from '@/lib/utils'
import { cities } from '@/config/site'

export const metadata = { title: 'Customers' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AdminCustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const adminCustomers = await getAdminCustomers()
  const query = param(params, 'q')
  const city = param(params, 'city')
  const status = param(params, 'status')

  const filtered = adminCustomers.filter(
    (customer) =>
      matchesQuery(customer, query, ['name', 'phone', 'email', 'id']) &&
      (!city || customer.city === city) &&
      (!status || customer.status === status),
  )

  const result = paginate(filtered, parsePage(params.page))
  const totalLtv = adminCustomers.reduce((sum, c) => sum + c.lifetimeValuePaisa, 0)

  const columns: Column<AdminCustomer>[] = [
    {
      key: 'name',
      header: 'Customer',
      primary: true,
      cell: (customer) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[12.5px] font-bold text-blue-700">
            {customer.name
              .split(' ')
              .map((part) => part[0])
              .join('')
              .slice(0, 2)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-900">{customer.name}</p>
            <p className="tabular truncate text-[12.5px] text-gray-500">{customer.id}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      cell: (customer) => (
        <div className="flex flex-col items-end gap-0.5 md:items-start">
          <span className="tabular whitespace-nowrap">{customer.phone}</span>
          <span className="truncate text-[12.5px] text-gray-500">{customer.email}</span>
        </div>
      ),
    },
    { key: 'city', header: 'City', cell: (c) => c.city },
    {
      key: 'orders',
      header: 'Orders',
      align: 'right',
      cell: (c) => <span className="tabular">{c.orderCount}</span>,
    },
    {
      key: 'ltv',
      header: 'Lifetime value',
      align: 'right',
      cell: (c) => (
        <span className="tabular font-semibold text-gray-900">{formatPrice(c.lifetimeValuePaisa)}</span>
      ),
    },
    {
      key: 'lastOrder',
      header: 'Last order',
      hideOnMobile: true,
      cell: (c) => <span className="whitespace-nowrap">{formatDate(c.lastOrderAt)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (customer) =>
        customer.status === 'active' ? (
          <StatusPill tone="success">Active</StatusPill>
        ) : (
          <StatusPill tone="neutral">Inactive</StatusPill>
        ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Customers"
        description="Order history and lifetime value. Prescription records are accessible only from an order."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Customers" value={String(adminCustomers.length)} />
        <StatCard
          label="Active"
          value={String(adminCustomers.filter((c) => c.status === 'active').length)}
          tone="success"
        />
        <StatCard label="Total lifetime value" value={formatPrice(totalLtv)} />
        <StatCard
          label="Average per customer"
          value={formatPrice(Math.round(totalLtv / adminCustomers.length))}
        />
      </div>

      <FilterBar
        searchPlaceholder="Search name, phone, email…"
        selects={[
          { key: 'city', label: 'City', options: cities.map((c) => ({ value: c, label: c })) },
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ],
          },
        ]}
      />

      <DataTable
        columns={columns}
        rows={result.rows}
        rowKey={(c) => c.id}
        caption="Customers"
        empty={
          <div>
            <p className="text-[14px] font-semibold text-gray-900">No customers match</p>
            <p className="mt-1 text-[13px] text-gray-500">Try a different search or clear filters.</p>
          </div>
        }
      />

      <Pagination result={result} searchParams={params} basePath="/admin/customers" />

      <p className="mt-4 text-[12.5px] text-gray-500">
        Health data is deliberately absent from this view. Prescriptions and lab reports are
        reachable only through the order they belong to, and every access is written to the audit
        log.
      </p>
    </>
  )
}
