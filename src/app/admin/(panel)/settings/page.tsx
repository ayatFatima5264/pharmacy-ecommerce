import { Check } from 'lucide-react'
import { PageHeader, Panel } from '@/components/admin/ui'
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
 * Live settings (features/settings): validated writes with history, code
 * defaults as the fail-safe read layer. The role matrix below is the REAL
 * permission model (auth/staff/permissions.ts, mirrored to the database by
 * seed:admin) — presenting it any other way hides the model from the person
 * administering it.
 */
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

      <div className="flex flex-col gap-4">
        <Panel title="Store details">
          <BusinessInfoForm value={business} />
        </Panel>

        <Panel title="Store status">
          <p className="mb-3 text-[12.5px] text-gray-500">
            Pausing a vertical stops new orders or bookings at checkout; browsing stays live.
            Enforced server-side, not just hidden buttons.
          </p>
          <StoreStatusForm value={storeStatus} />
        </Panel>

        <Panel title="Roles & permissions">
          <p className="mb-3 text-[12.5px] text-gray-500">
            Read-only view of the permission matrix. Role changes are a data operation
            (user_roles), not a settings toggle.
          </p>
          <div className="overflow-x-auto">
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
                  <tr key={permission} className="border-b border-gray-100">
                    <td className="tabular py-1.5 pr-4 text-gray-700">{permission}</td>
                    {roles.map((role) => (
                      <td key={role} className="px-3 py-1.5 text-center">
                        {roleHasPermission(role, permission) ? (
                          <Check className="mx-auto h-3.5 w-3.5 text-green-600" aria-hidden="true" />
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
        </Panel>
      </div>
    </>
  )
}
