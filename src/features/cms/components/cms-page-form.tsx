'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Field, Input, Textarea } from '@/components/ui/field'
import { saveCmsPage } from '@/features/cms/actions'
import type { ActionState } from '@/features/catalog/actions/action-result'

const idle: ActionState = { status: 'idle' }

export function CmsPageForm({ slug, title, body }: { slug: string; title: string; body: string }) {
  const [state, formAction] = useActionState(saveCmsPage, idle)

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />

      {state.status === 'error' && (
        <p role="alert" className="flex items-center gap-2 rounded-sm bg-red-50 p-2.5 text-[13px] text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      )}
      {state.status === 'success' && (
        <p role="status" className="flex items-center gap-2 rounded-sm bg-green-50 p-2.5 text-[13px] text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      )}

      <Field label="Title" htmlFor={`${slug}-title`} required>
        <Input id={`${slug}-title`} name="title" defaultValue={title} required />
      </Field>
      <Field label="Content" htmlFor={`${slug}-body`} required>
        <Textarea id={`${slug}-body`} name="body" defaultValue={body} rows={10} required />
      </Field>

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 w-fit items-center gap-2 rounded-md bg-blue-600 px-4 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400"
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
      {pending ? 'Publishing' : 'Publish'}
    </button>
  )
}
