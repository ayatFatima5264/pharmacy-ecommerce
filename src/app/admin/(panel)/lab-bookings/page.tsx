import {
  Banknote,
  Building2,
  CalendarClock,
  Clock,
  FlaskConical,
  Home,
  Microscope,
  User,
} from 'lucide-react'
import { PageHeader, StatCard } from '@/components/admin/ui'
import { AdminEmptyState, DateChip, SegmentedTabs } from '@/components/admin/blocks'
import { FilterBar } from '@/components/admin/filter-bar'
import { Pagination } from '@/components/admin/pagination'
import { BookingStatusPill, bookingStatusOptions } from '@/components/admin/status'
import { getAdminBookings } from '@/lib/data/admin'
import { matchesQuery, paginate, param, parsePage } from '@/lib/data/paginate'
import { formatPrice } from '@/lib/utils'
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

  // Appointment-book tabs: the status pipeline reads left to right.
  function tabHref(target?: string) {
    const qs = new URLSearchParams()
    if (query) qs.set('q', query)
    if (city) qs.set('city', city)
    if (mode) qs.set('mode', mode)
    if (target) qs.set('status', target)
    const s = qs.toString()
    return s ? `/admin/lab-bookings?${s}` : '/admin/lab-bookings'
  }
  const statusTabs = [
    { label: 'All', href: tabHref(), active: !status, count: adminBookings.length },
    ...bookingStatusOptions.map((option) => ({
      label: option.label,
      href: tabHref(option.value),
      active: status === option.value,
      count: adminBookings.filter((b) => b.status === option.value).length,
    })),
  ]

  return (
    <>
      <PageHeader
        title="Lab bookings"
        description="Home collections and lab visits taken through checkout."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Bookings" icon={Microscope} value={String(adminBookings.length)} />
        <StatCard label="Scheduled" icon={CalendarClock} value={String(scheduled)} tone={scheduled ? 'warning' : undefined} />
        <StatCard label="Home collections" icon={Home} value={String(homeCollections)} />
        <StatCard label="Booked value" icon={Banknote} value={formatPrice(bookedValue)} />
      </div>

      <SegmentedTabs tabs={statusTabs} label="Booking status" />

      <FilterBar
        searchPlaceholder="Search booking, patient, test…"
        selects={[
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

      {/* Appointment cards: the date tile leads, exactly like a diary page —
          staff plan collections by day, not by booking number. */}
      {result.rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200/80 bg-white shadow-e1">
          <AdminEmptyState
            icon={Microscope}
            title="No bookings match"
            description="New lab bookings land here the moment checkout confirms them. Try another status tab or clear the filters."
          />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {result.rows.map((booking) => (
            <li
              key={booking.id}
              className="flex gap-4 rounded-lg border border-gray-200/80 bg-white p-5 shadow-e1 transition-shadow duration-medium hover:shadow-e2"
            >
              <div className="flex flex-col items-center gap-1.5">
                <DateChip date={booking.scheduledAt} />
                <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-500">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {booking.slot}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="tabular text-[12px] font-semibold text-gray-400">
                      {booking.bookingNumber}
                    </p>
                    <p className="flex items-center gap-1.5 truncate text-[14px] font-bold text-gray-900">
                      <User className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                      {booking.patientName}
                    </p>
                  </div>
                  <BookingStatusPill status={booking.status} />
                </div>

                <p className="mt-2 flex items-center gap-1.5 text-[13px] text-gray-700">
                  <FlaskConical className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden="true" />
                  <span className="truncate">
                    {booking.testName}
                    <span className="text-gray-500"> · {booking.labName}</span>
                  </span>
                </p>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-[12px] font-semibold text-gray-600">
                    {booking.collectionMode === 'home' ? (
                      <Home className="h-3 w-3 text-blue-600" aria-hidden="true" />
                    ) : (
                      <Building2 className="h-3 w-3 text-blue-600" aria-hidden="true" />
                    )}
                    {booking.collectionMode === 'home' ? 'Home' : 'Lab visit'} · {booking.city}
                  </span>
                  <span className="tabular text-[14px] font-bold text-gray-900">
                    {formatPrice(booking.pricePaisa)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination result={result} searchParams={params} basePath="/admin/lab-bookings" />
    </>
  )
}
