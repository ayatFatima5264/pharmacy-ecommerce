import { Check, Power, ShieldCheck, Store } from 'lucide-react'
import { PageHeader } from '@/components/admin/ui'
import { requirePermission } from '@/features/auth/staff/guards'
import { getSetting } from '@/features/settings/queries'
import { BusinessInfoForm, StoreStatusForm } from '@/features/settings/components/settings-forms'
import {
  PERMISSIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  roleHasPermission,
  type RoleKey,
} from '@/features/auth/staff/permissions'

export const metadata = { title: 'Settings' }
export const dynamic = 'force-dynamic'

/**
 * Settings center, Vercel-style: a sticky section rail on the left, one card
 * per concern on the right. Anchor links, zero client JS — the rail is
 * navigation, not state.
 *
 * Live settings (features/settings): validated writes with history, code
 * defaults as the fail-safe read layer. The role matrix below is the REAL
 * permission model (auth/staff/permissions.ts, mirrored to the database by
 * seed:admin) — presenting it any other way hides the model from the person
 * administering it.
 */

const SECTIONS = [
  { id: 'store-details', label: 'Store details', icon: Store },
  { id: 'store-status', label: 'Store status', icon: Power },
  { id: 'roles', label: 'Roles & permissions', icon: ShieldCheck },
] as const

export default async function AdminSettingsPage() {
  await requirePermission('settings.manage')

  const [business, storeStatus] = await Promise.all([
    getSetting('business.info'),
    getSetting('store.status'),
  ])

  const roles = Object.keys(ROLE_PERMISSIONS) as RoleKey[]

  return (
    <>
      <PageHeader
        title="Settings"
        description="Business details and store status. Changes apply immediately — no deploy."
      />

      <div className="grid gap-6 lg:grid-cols-[230px_1fr] lg:items-start">
        {/* Section rail */}
        <nav
          aria-label="Settings sections"
          className="top-24 hidden rounded-lg border border-gray-200/80 bg-white p-2 shadow-e1 lg:sticky lg:block"
        >
          <ul className="flex flex-col gap-0.5">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-semibold text-gray-600 transition-colors duration-fast hover:bg-blue-50/60 hover:text-blue-700"
                >
                  <section.icon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Section cards */}
        <div className="flex min-w-0 flex-col gap-6">
          <section
            id="store-details"
            className="scroll-mt-24 rounded-lg border border-gray-200/80 bg-white shadow-e1"
          >
            <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                <Store className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900">Store details</h2>
                <p className="text-[12.5px] text-gray-500">
                  Name, contact, and address shown across the storefront.
                </p>
              </div>
            </div>
            <div className="p-6">
              <BusinessInfoForm value={business} />
            </div>
          </section>

          <section
            id="store-status"
            className="scroll-mt-24 rounded-lg border border-gray-200/80 bg-white shadow-e1"
          >
            <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-50 text-amber-700">
                <Power className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900">Store status</h2>
                <p className="text-[12.5px] text-gray-500">
                  Pausing a vertical stops new orders or bookings at checkout; browsing stays live.
                  Enforced server-side, not just hidden buttons.
                </p>
              </div>
            </div>
            <div className="p-6">
              <StoreStatusForm value={storeStatus} />
            </div>
          </section>

          <section
            id="roles"
            className="scroll-mt-24 rounded-lg border border-gray-200/80 bg-white shadow-e1"
          >
            <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-green-50 text-green-700">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900">Roles &amp; permissions</h2>
                <p className="text-[12.5px] text-gray-500">
                  Read-only view of the permission matrix. Role changes are a data operation
                  (user_roles), not a settings toggle.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto p-6">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="py-2 pr-4 font-semibold">Permission</th>
                    {roles.map((role) => (
                      <th key={role} className="px-3 py-2 text-center font-semibold">
                        {ROLE_LABELS[role]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS.map((permission) => (
                    <tr key={permission} className="border-b border-gray-100 last:border-0">
                      <td className="tabular py-2 pr-4 text-gray-700">{permission}</td>
                      {roles.map((role) => (
                        <td key={role} className="px-3 py-2 text-center">
                          {roleHasPermission(role, permission) ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-50">
                              <Check className="h-3 w-3 text-green-700" aria-hidden="true" />
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
