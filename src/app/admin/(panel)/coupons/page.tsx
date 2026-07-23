import { AlertTriangle, Plus, Tag, Ticket, Zap } from 'lucide-react'
import { PageHeader, StatCard, StatusPill } from '@/components/admin/ui'
import { SegmentedTabs } from '@/components/admin/blocks'
import { DataTable, type Column } from '@/components/admin/data-table'
import { FilterBar } from '@/components/admin/filter-bar'
import { Pagination } from '@/components/admin/pagination'
import { Button } from '@/components/ui/button'
import { ADMIN_NOW, getAdminCoupons, type AdminCoupon } from '@/lib/data/admin'
import { matchesQuery, paginate, param, parsePage } from '@/lib/data/paginate'
import { useDb } from '@/lib/data/source'
import { formatDate, formatPrice } from '@/lib/utils'

export const metadata = { title: 'Coupons' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/** A coupon is only usable if it is active, started, unexpired, and has quota. */
function couponState(coupon: AdminCoupon, now: number) {
  const started = new Date(coupon.startsAt).getTime() <= now
  const expired = coupon.expiresAt ? new Date(coupon.expiresAt).getTime() < now : false
  const exhausted = coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit

  if (!coupon.isActive) return { label: 'Disabled', tone: 'neutral' as const }
  if (expired) return { label: 'Expired', tone: 'neutral' as const }
  if (!started) return { label: 'Scheduled', tone: 'info' as const }
  if (exhausted) return { label: 'Limit reached', tone: 'danger' as const }
  return { label: 'Live', tone: 'success' as const }
}

function describeDiscount(coupon: AdminCoupon) {
  switch (coupon.discountType) {
    case 'percentage':
      return `${coupon.discountValue}% off`
    case 'fixed_amount':
      return `${formatPrice(coupon.discountValue * 100)} off`
    case 'free_shipping':
      return 'Free delivery'
  }
}

export default async function AdminCouponsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const adminCoupons = await getAdminCoupons()
  const now = useDb() ? Date.now() : ADMIN_NOW
  const query = param(params, 'q')
  const type = param(params, 'type')
  const state = param(params, 'state')

  const filtered = adminCoupons.filter((coupon) => {
    if (!matchesQuery(coupon, query, ['code'])) return false
    if (type && coupon.discountType !== type) return false
    if (state && couponState(coupon, now).label.toLowerCase() !== state) return false
    return true
  })

  const result = paginate(filtered, parsePage(params.page))

  const columns: Column<AdminCoupon>[] = [
    {
      key: 'code',
      header: 'Code',
      primary: true,
      cell: (coupon) => (
        <div className="min-w-0">
          <p className="truncate font-bold uppercase tracking-[0.03em] text-gray-900">
            {coupon.code}
          </p>
          <p className="truncate text-[12.5px] text-gray-500">{describeDiscount(coupon)}</p>
        </div>
      ),
    },
    {
      key: 'conditions',
      header: 'Conditions',
      hideOnMobile: true,
      cell: (coupon) => (
        <div className="tabular text-[12.5px] text-gray-500">
          <p>Min order {coupon.minOrderPaisa === 0 ? 'none' : formatPrice(coupon.minOrderPaisa)}</p>
          {/* An uncapped percentage coupon is an unbounded liability, so the cap
              is surfaced rather than buried in an edit form. */}
          {coupon.discountType === 'percentage' && (
            <p>
              {coupon.maxDiscountPaisa
                ? `Capped at ${formatPrice(coupon.maxDiscountPaisa)}`
                : 'Uncapped'}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'usage',
      header: 'Usage',
      align: 'right',
      cell: (coupon) => {
        const percent = coupon.usageLimit
          ? Math.min(100, Math.round((coupon.usageCount / coupon.usageLimit) * 100))
          : null
        return (
          <div className="flex flex-col items-end gap-1">
            <span className="tabular font-semibold text-gray-900">
              {coupon.usageCount.toLocaleString('en-PK')}
              {coupon.usageLimit ? ` / ${coupon.usageLimit.toLocaleString('en-PK')}` : ''}
            </span>
            {percent !== null && (
              <span className="h-1 w-20 overflow-hidden rounded-full bg-gray-100">
                <span
                  className={percent >= 100 ? 'block h-full bg-red-600' : 'block h-full bg-blue-600'}
                  style={{ width: `${percent}%` }}
                />
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'window',
      header: 'Valid until',
      cell: (coupon) =>
        coupon.expiresAt ? (
          <span className="whitespace-nowrap">{formatDate(coupon.expiresAt)}</span>
        ) : (
          <span className="text-gray-400">No expiry</span>
        ),
    },
    {
      key: 'state',
      header: 'State',
      cell: (coupon) => {
        const { label, tone } = couponState(coupon, now)
        return <StatusPill tone={tone}>{label}</StatusPill>
      },
    },
  ]

  const live = adminCoupons.filter((c) => couponState(c, now).label === 'Live').length
  const totalRedemptions = adminCoupons.reduce((sum, c) => sum + c.usageCount, 0)

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Discount codes and their redemption limits."
        action={
          <Button size="sm">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create coupon
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Coupons" icon={Tag} value={String(adminCoupons.length)} />
        <StatCard label="Live now" icon={Zap} value={String(live)} tone="success" />
        <StatCard label="Total redemptions" icon={Ticket} value={totalRedemptions.toLocaleString('en-PK')} />
        <StatCard
          label="Limit reached" icon={AlertTriangle}
          value={String(adminCoupons.filter((c) => couponState(c, now).label === 'Limit reached').length)}
          tone="warning"
        />
      </div>

      <SegmentedTabs
        label="Coupon state"
        tabs={[
          { label: 'All', href: '/admin/coupons', active: !state, count: adminCoupons.length },
          ...(['live', 'scheduled', 'expired', 'disabled', 'limit reached'] as const).map((value) => ({
            label: value.charAt(0).toUpperCase() + value.slice(1),
            href: `/admin/coupons?state=${encodeURIComponent(value)}`,
            active: state === value,
            count: adminCoupons.filter((c) => couponState(c, now).label.toLowerCase() === value).length,
          })),
        ]}
      />

      <FilterBar
        searchPlaceholder="Search coupon code…"
        selects={[
          {
            key: 'type',
            label: 'Type',
            options: [
              { value: 'percentage', label: 'Percentage' },
              { value: 'fixed_amount', label: 'Fixed amount' },
              { value: 'free_shipping', label: 'Free shipping' },
            ],
          },
        ]}
      />

      <DataTable columns={columns} rows={result.rows} rowKey={(c) => c.id} caption="Coupons" />
      <Pagination result={result} searchParams={params} basePath="/admin/coupons" />
    </>
  )
}
