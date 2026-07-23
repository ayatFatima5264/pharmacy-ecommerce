'use client'

import { useActionState } from 'react'
import { AdminField, AdminInput, AdminTextarea, FormBanner, SubmitButton, fieldError } from '@/components/admin/form-kit'
import { SOCIAL_ICONS } from '@/components/shared/social-icons'
import { saveContactInfo, saveSocialLinks } from '@/features/settings/actions'
import { SOCIAL_NETWORKS, type BusinessInfo, type SocialLinks, type SocialNetwork } from '@/features/settings/registry'
import { idleState } from '@/features/catalog/actions/action-result'

/**
 * Content Management forms (V2). Both write through the settings registry —
 * validated, attributed, history-snapshotted — and the storefront footer
 * re-renders from the same keys, so "save" IS "publish".
 */

const NETWORK_LABELS: Record<SocialNetwork, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  twitter: 'Twitter / X',
  pinterest: 'Pinterest',
}

export function ContactInfoForm({ value }: { value: BusinessInfo }) {
  const [state, formAction] = useActionState(saveContactInfo, idleState)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormBanner state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField label="Business name" name="name" required error={fieldError(state, 'name')}>
          <AdminInput id="name" name="name" defaultValue={value.name} required />
        </AdminField>
        <AdminField label="Tagline" name="tagline" error={fieldError(state, 'tagline')}>
          <AdminInput id="tagline" name="tagline" defaultValue={value.tagline} />
        </AdminField>
        <AdminField label="Phone" name="phone" required error={fieldError(state, 'phone')}>
          <AdminInput id="phone" name="phone" type="tel" defaultValue={value.phone} required />
        </AdminField>
        <AdminField
          label="WhatsApp number"
          name="whatsapp"
          hint="Used by the floating WhatsApp button and contact page."
          error={fieldError(state, 'whatsapp')}
        >
          <AdminInput id="whatsapp" name="whatsapp" type="tel" defaultValue={value.whatsapp} />
        </AdminField>
        <AdminField label="Email" name="email" required error={fieldError(state, 'email')}>
          <AdminInput id="email" name="email" type="email" defaultValue={value.email} required />
        </AdminField>
        <AdminField
          label="Emergency number"
          name="emergencyPhone"
          hint="Optional — shown alongside the emergency notice."
          error={fieldError(state, 'emergencyPhone')}
        >
          <AdminInput id="emergencyPhone" name="emergencyPhone" type="tel" defaultValue={value.emergencyPhone} />
        </AdminField>
      </div>

      <AdminField label="Address" name="address" required error={fieldError(state, 'address')}>
        <AdminTextarea id="address" name="address" rows={2} defaultValue={value.address} required />
      </AdminField>

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField
          label="Opening hours"
          name="hours"
          hint='e.g. "Every day, 9:00 AM – 11:00 PM"'
          error={fieldError(state, 'hours')}
        >
          <AdminInput id="hours" name="hours" defaultValue={value.hours} />
        </AdminField>
        <AdminField
          label="Google Maps link"
          name="mapsUrl"
          hint="Full share link. Leave blank to use the configured map pin."
          error={fieldError(state, 'mapsUrl')}
        >
          <AdminInput id="mapsUrl" name="mapsUrl" type="url" placeholder="https://maps.google.com/…" defaultValue={value.mapsUrl} />
        </AdminField>
      </div>

      <div className="flex justify-end border-t border-gray-100 pt-4">
        <SubmitButton pendingLabel="Saving…">Save contact information</SubmitButton>
      </div>
    </form>
  )
}

export function SocialLinksForm({ value }: { value: SocialLinks }) {
  const [state, formAction] = useActionState(saveSocialLinks, idleState)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormBanner state={state} />

      <ul className="flex flex-col divide-y divide-gray-100">
        {SOCIAL_NETWORKS.map((network) => {
          const NetworkIcon = SOCIAL_ICONS[network]
          const entry = value[network]
          return (
            <li key={network} className="flex flex-wrap items-center gap-3 py-3.5 sm:flex-nowrap">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-50 text-gray-500">
                <NetworkIcon className="h-4 w-4" />
              </span>
              <span className="w-28 shrink-0 text-[13.5px] font-semibold text-gray-900">
                {NETWORK_LABELS[network]}
              </span>
              <AdminInput
                name={`${network}.url`}
                type="url"
                placeholder={`https://${network === 'twitter' ? 'x' : network}.com/yourpage`}
                defaultValue={entry.url === '#' ? '' : entry.url}
                aria-label={`${NETWORK_LABELS[network]} URL`}
                className="min-w-0 flex-1"
              />
              {/* Visibility switch: disabled networks disappear from the footer. */}
              <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[12.5px] font-semibold text-gray-600">
                <input
                  type="checkbox"
                  name={`${network}.enabled`}
                  defaultChecked={entry.enabled}
                  className="peer sr-only"
                />
                <span className="relative h-5 w-9 rounded-full bg-gray-200 transition-colors duration-medium after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-e1 after:transition-transform after:duration-medium peer-checked:bg-blue-600 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-600 peer-focus-visible:ring-offset-2" />
                Visible
              </label>
            </li>
          )
        })}
      </ul>

      <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
        <p className="text-[12.5px] text-gray-500">
          The storefront footer updates automatically after saving.
        </p>
        <SubmitButton pendingLabel="Saving…">Save social links</SubmitButton>
      </div>
    </form>
  )
}
