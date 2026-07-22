'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, CheckCircle2, Loader2, Upload } from 'lucide-react'
import { uploadImport, runCommit } from '@/features/imports/actions'
import type { ActionState } from '@/features/catalog/actions/action-result'

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

export function UploadImportForm() {
  const [state, formAction] = useActionState(uploadImport, idle)
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Banner state={state} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-gray-700">
          Type
          <select
            name="type"
            className="h-10 rounded-sm border border-gray-200 bg-white px-3 text-[13.5px]"
            defaultValue="products"
          >
            <option value="products">Products</option>
            <option value="lab_tests">Lab tests</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-gray-700">
          Excel file (.xlsx, ≤5 MB)
          <input
            type="file"
            name="file"
            accept=".xlsx,.xls"
            required
            className="h-10 rounded-sm border border-gray-200 bg-white px-3 py-2 text-[13px]"
          />
        </label>
        <SubmitButton label="Upload & validate" pendingLabel="Validating" icon />
      </div>
    </form>
  )
}

export function CommitImportForm({ importId }: { importId: string }) {
  const [state, formAction] = useActionState(runCommit, idle)
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="importId" value={importId} />
      <Banner state={state} />
      <SubmitButton label="Commit valid rows" pendingLabel="Committing" />
    </form>
  )
}

function SubmitButton({
  label,
  pendingLabel,
  icon,
}: {
  label: string
  pendingLabel: string
  icon?: boolean
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        icon && <Upload className="h-4 w-4" aria-hidden="true" />
      )}
      {pending ? pendingLabel : label}
    </button>
  )
}
