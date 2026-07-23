import Link from 'next/link'
import {
  Banknote,
  CalendarClock,
  Mail,
  MapPin,
  Phone,
  ShoppingBag,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react'
import { PageHeader, StatCard, StatusPill } from '@/components/admin/ui'
import { AdminEmptyState, Avatar } from '@/components/admin/blocks'
import { FilterBar } from '@/components/admin/filter-bar'
import { Pagination } from '@/components/admin/pagination'
import { getAdminCustomers } from '@/lib/data/admin'
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
  // Scales the per-card LTV meter: the best customer defines 100%.
  const maxLtv = Math.max(...adminCustomers.map((c) => c.lifetimeValuePaisa), 1)

  return (
    <>
      <PageHeader
        title="Customers"
        description="Order history and lifetime value. Prescription records are accessible only from an order."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Customers" icon={Users} value={String(adminCustomers.length)} />
        <StatCard
          label="Active" icon={UserCheck}
          value={String(adminCustomers.filter((c) => c.status === 'active').length)}
          tone="success"
        />
        <StatCard label="Total lifetime value" icon={Banknote} value={formatPrice(totalLtv)} />
        <StatCard
          label="Average per customer" icon={Wallet}
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

      {/* CRM cards, not table rows: a customer is a relationship, and the card
          gives each one identity (avatar), reachability (contact), and worth
          (order count + LTV meter) in a single glance. */}
      {result.rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200/80 bg-white shadow-e1">
          <AdminEmptyState
            icon={Users}
            title="No customers match"
            description="Try a different search or clear the filters — new customers appear here after their first order."
          />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {result.rows.map((customer) => (
            <li
              key={customer.id}
              className="flex flex-col rounded-lg border border-gray-200/80 bg-white p-5 shadow-e1 transition-shadow duration-medium hover:shadow-e2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={customer.name} size="lg" />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-gray-900">{customer.name}</p>
                    <p className="flex items-center gap-1 text-[12px] text-gray-500">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                      {customer.city}
                    </p>
                  </div>
                </div>
                {customer.status === 'active' ? (
                  <StatusPill tone="success">Active</StatusPill>
                ) : (
                  <StatusPill tone="neutral">Inactive</StatusPill>
                )}
              </div>

              <dl className="mt-4 flex flex-col gap-1.5 border-t border-gray-100 pt-4 text-[13px]">
                <div className="flex items-center gap-2 text-gray-700">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                  <dt className="sr-only">Phone</dt>
                  <dd className="tabular">{customer.phone}</dd>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                  <dt className="sr-only">Email</dt>
                  <dd className="truncate">{customer.email}</dd>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                  <dt className="sr-only">Last order</dt>
                  <dd>Last order {formatDate(customer.lastOrderAt)}</dd>
                </div>
              </dl>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
                <div>
                  <p className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-gray-400">
                    <ShoppingBag className="h-3 w-3" aria-hidden="true" />
                    Orders
                  </p>
                  <p className="tabular mt-1 text-[18px] font-bold leading-none text-gray-900">
                    {customer.orderCount}
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-gray-400">
                    <Banknote className="h-3 w-3" aria-hidden="true" />
                    Lifetime value
                  </p>
                  <p className="tabular mt-1 text-[18px] font-bold leading-none text-gray-900">
                    {formatPrice(customer.lifetimeValuePaisa)}
                  </p>
                </div>
              </div>

              {/* LTV meter, scaled to the store's best customer. */}
              <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-500"
                  style={{
                    width: `${Math.max(3, Math.round((customer.lifetimeValuePaisa / maxLtv) * 100))}%`,
                  }}
                />
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Link
                  href={`/admin/orders?q=${encodeURIComponent(customer.name)}`}
                  className="flex h-8 flex-1 items-center justify-center rounded-md border border-gray-200 text-[12.5px] font-semibold text-gray-700 transition-colors duration-fast hover:border-blue-600/30 hover:bg-blue-50/50 hover:text-blue-700"
                >
                  View orders
                </Link>
                <a
                  href={`tel:${customer.phone.replace(/\s/g, '')}`}
                  className="flex h-8 flex-1 items-center justify-center rounded-md border border-gray-200 text-[12.5px] font-semibold text-gray-700 transition-colors duration-fast hover:border-blue-600/30 hover:bg-blue-50/50 hover:text-blue-700"
                >
                  Call
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination result={result} searchParams={params} basePath="/admin/customers" />

      <p className="mt-4 text-[12.5px] text-gray-500">
        Health data is deliberately absent from this view. Prescriptions and lab reports are
        reachable only through the order they belong to, and every access is written to the audit
        log.
      </p>
    </>
  )
}
