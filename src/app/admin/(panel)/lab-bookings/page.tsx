import { Home, MapPin } from 'lucide-react'
import { PageHeader, StatCard } from '@/components/admin/ui'
import { DataTable, type Column } from '@/components/admin/data-table'
import { FilterBar } from '@/components/admin/filter-bar'
import { Pagination } from '@/components/admin/pagination'
import { BookingStatusPill, bookingStatusOptions } from '@/components/admin/status'
import { getAdminBookings, type AdminBooking } from '@/lib/data/admin'
import { matchesQuery, paginate, param, parsePage } from '@/lib/data/paginate'
import { formatDate, formatPrice } from '@/lib/utils'
import { cities } from '@/config/site'

export const metadata = { title: 'Lab Bookings' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AdminLabBookingsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams

  // Live checkout bookings lead; demo rows only without a database.
  const adminBookings = await getAdminBookings()

  const query = param(params, 'q')
  const status = param(params, 'status')
  const city = param(params, 'city')
  const mode = param(params, 'mode')

  const filtered = adminBookings.filter(
    (booking) =>
      matchesQuery(booking, query, ['bookingNumber', 'patientName', 'testName', 'labName']) &&
      (!status || booking.status === status) &&
      (!city || booking.city === city) &&
      (!mode || booking.collectionMode === mode),
  )

  const result = paginate(filtered, parsePage(params.page))

  const scheduled = adminBookings.filter((b) => b.status === 'scheduled').length
  const homeCollections = adminBookings.filter((b) => b.collectionMode === 'home').length
  const bookedValue = adminBookings
    .filter((b) => b.status !== 'cancelled')
    .reduce((sum, b) => sum + b.pricePaisa, 0)

  const columns: Column<AdminBooking>[] = [
    {
      key: 'booking',
      header: 'Booking',
      primary: true,
      cell: (booking) => (
        <div className="min-w-0">
          <p className="tabular truncate font-semibold text-gray-900">{booking.bookingNumber}</p>
          <p className="truncate text-[12.5px] text-gray-500">{booking.patientName}</p>
        </div>
      ),
    },
    {
      key: 'test',
      header: 'Tests',
      cell: (booking) => (
        <div className="min-w-0 md:max-w-[220px]">
          <p className="truncate">{booking.testName}</p>
          <p className="truncate text-[12.5px] text-gray-500">{booking.labName}</p>
        </div>
      ),
    },
    {
      key: 'schedule',
      header: 'Scheduled',
      cell: (booking) => (
        <div className="flex flex-col items-end gap-0.5 md:items-start">
          <span className="whitespace-nowrap">{formatDate(booking.scheduledAt)}</span>
          <span className="text-[12.5px] text-gray-500">{booking.slot}</span>
        </div>
      ),
    },
    {
      key: 'mode',
      header: 'Collection',
      hideOnMobile: true,
      cell: (booking) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          {booking.collectionMode === 'home' ? (
            <Home className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
          ) : (
            <MapPin className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
          )}
          {booking.collectionMode === 'home' ? `Home · ${booking.city}` : `Lab visit · ${booking.city}`}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (booking) => <BookingStatusPill status={booking.status} />,
    },
    {
      key: 'price',
      header: 'Value',
      align: 'right',
      cell: (booking) => (
        <span className="tabular font-semibold text-gray-900">{formatPrice(booking.pricePaisa)}</span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Lab bookings"
        description="Home collections and lab visits taken through checkout."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Bookings" value={String(adminBookings.length)} />
        <StatCard label="Scheduled" value={String(scheduled)} tone={scheduled ? 'warning' : undefined} />
        <StatCard label="Home collections" value={String(homeCollections)} />
        <StatCard label="Booked value" value={formatPrice(bookedValue)} />
      </div>

      <FilterBar
        searchPlaceholder="Search booking, patient, test…"
        selects={[
          { key: 'status', label: 'Status', options: bookingStatusOptions },
          { key: 'city', label: 'City', options: cities.map((c) => ({ value: c, label: c })) },
          {
            key: 'mode',
            label: 'Collection',
            options: [
              { value: 'home', label: 'Home collection' },
              { value: 'lab_visit', label: 'Lab visit' },
            ],
          },
        ]}
      />

      <DataTable
        columns={columns}
        rows={result.rows}
        rowKey={(b) => b.id}
        caption="Lab bookings"
        empty={
          <div>
            <p className="text-[14px] font-semibold text-gray-900">No bookings match</p>
            <p className="mt-1 text-[13px] text-gray-500">Try a different search or clear filters.</p>
          </div>
        }
      />

      <Pagination result={result} searchParams={params} basePath="/admin/lab-bookings" />
    </>
  )
}
