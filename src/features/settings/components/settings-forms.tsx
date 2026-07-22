'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Field, Input, Textarea } from '@/components/ui/field'
import { saveBusinessInfo, saveStoreStatus } from '@/features/settings/actions'
import type { ActionState } from '@/features/catalog/actions/action-result'
import type { BusinessInfo, StoreStatus } from '@/features/settings/registry'

const idle: ActionState = { status: 'idle' }

function Banner({ state }: { state: ActionState }) {
  if (state.status === 'error')
    return (
      <p role="alert" className="flex items-center gap-2 rounded-sm bg-red-50 p-2.5 text-[13px] text-red-700">
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {state.message}
      </p>
    )
  if (state.status === 'success')
    return (
      <p role="status" className="flex items-center gap-2 rounded-sm bg-green-50 p-2.5 text-[13px] text-green-700">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        {state.message}
      </p>
    )
  return null
}

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 w-fit items-center gap-2 rounded-md bg-blue-600 px-4 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400"
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
      {pending ? 'Saving' : 'Save changes'}
    </button>
  )
}

export function BusinessInfoForm({ value }: { value: BusinessInfo }) {
  const [state, formAction] = useActionState(saveBusinessInfo, idle)
  const err = (key: string) => (state.status === 'error' ? state.fieldErrors?.[key] : undefined)

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Banner state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Store name" htmlFor="biz-name" error={err('name')} required>
          <Input id="biz-name" name="name" defaultValue={value.name} required />
        </Field>
        <Field label="Tagline" htmlFor="biz-tagline" error={err('tagline')}>
          <Input id="biz-tagline" name="tagline" defaultValue={value.tagline} />
        </Field>
        <Field label="Phone" htmlFor="biz-phone" error={err('phone')} required>
          <Input id="biz-phone" name="phone" defaultValue={value.phone} required />
        </Field>
        <Field label="Email" htmlFor="biz-email" error={err('email')} required>
          <Input id="biz-email" name="email" type="email" defaultValue={value.email} required />
        </Field>
      </div>
      <Field label="Address" htmlFor="biz-address" error={err('address')} required>
        <Textarea id="biz-address" name="address" defaultValue={value.address} rows={2} required />
      </Field>
      <SaveButton />
    </form>
  )
}

export function StoreStatusForm({ value }: { value: StoreStatus }) {
  const [state, formAction] = useActionState(saveStoreStatus, idle)

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Banner state={state} />
      <label className="flex items-center gap-2.5 text-[13.5px] text-gray-700">
        <input
          type="checkbox"
          name="pharmacyOpen"
          defaultChecked={value.pharmacyOpen}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
        />
        Accept medicine orders
      </label>
      <label className="flex items-center gap-2.5 text-[13.5px] text-gray-700">
        <input
          type="checkbox"
          name="labOpen"
          defaultChecked={value.labOpen}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
        />
        Accept lab bookings
      </label>
      <Field
        label="Pause message"
        htmlFor="status-message"
        hint="Shown to customers when a vertical is paused."
      >
        <Input id="status-message" name="message" defaultValue={value.message} />
      </Field>
      <SaveButton />
    </form>
  )
}
