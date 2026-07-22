'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useActionState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import {
  AdminField,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  FormBanner,
  SubmitButton,
  fieldError,
} from '@/components/admin/form-kit'
import { saveBrand, saveCategory, deleteBrand, deleteCategory } from '@/features/catalog/actions/taxonomy-actions'
import { idleState } from '@/features/catalog/actions/action-result'
import type { Brand, Category } from '@/types'

/**
 * Create and edit share one form — the fields are identical, and duplicating
 * them is how the two drift apart.
 */
export function CategoryPanel({
  categories,
  editing,
}: {
  categories: Category[]
  editing?: Category
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(Boolean(editing))
  const action = saveCategory.bind(null, editing?.id ?? null)
  const [state, formAction] = useActionState(action, idleState)

  React.useEffect(() => setOpen(Boolean(editing)), [editing])

  React.useEffect(() => {
    if (state.status === 'success' && editing) {
      // Drop ?edit= so a refresh does not reopen the editor.
      router.push('/admin/categories')
      router.refresh()
    }
  }, [state.status, editing, router])

  function close() {
    setOpen(false)
    if (editing) router.push('/admin/categories')
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 inline-flex h-9 items-center gap-2 rounded-sm bg-blue-600 px-4 text-[13.5px] font-semibold text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add category
      </button>
    )
  }

  return (
    <div className="mb-4 rounded-md border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-bold text-gray-900">
          {editing ? `Edit ${editing.name}` : 'Add category'}
        </h2>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-sm text-gray-400 hover:bg-gray-100"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <form action={formAction} className="flex flex-col gap-4" key={editing?.id ?? 'new'}>
        <FormBanner state={state} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminField label="Name" name="name" required error={fieldError(state, 'name')}>
            <AdminInput id="name" name="name" defaultValue={editing?.name} placeholder="Pain Relief" required />
          </AdminField>

          <AdminField
            label="Slug"
            name="slug"
            error={fieldError(state, 'slug')}
            hint="Blank to generate"
          >
            <AdminInput id="slug" name="slug" defaultValue={editing?.slug} placeholder="pain-relief" />
          </AdminField>

          <AdminField label="Icon" name="icon" required error={fieldError(state, 'icon')}>
            <AdminInput id="icon" name="icon" defaultValue={editing?.icon ?? '💊'} maxLength={8} required />
          </AdminField>

          <AdminField label="Parent" name="parentId" error={fieldError(state, 'parentId')}>
            <AdminSelect id="parentId" name="parentId" defaultValue={editing?.parentId ?? ''}>
              <option value="">Top level</option>
              {categories
                .filter((c) => c.id !== editing?.id)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </AdminSelect>
          </AdminField>

          <AdminField
            label="Description"
            name="description"
            required
            error={fieldError(state, 'description')}
            className="sm:col-span-2 lg:col-span-4"
          >
            <AdminTextarea
              id="description"
              name="description"
              defaultValue={editing?.description}
              className="min-h-16"
              required
            />
          </AdminField>
        </div>

        <div className="flex gap-2">
          <SubmitButton pendingLabel="Saving…">
            {editing ? 'Save changes' : 'Create category'}
          </SubmitButton>
          <button
            type="button"
            onClick={close}
            className="inline-flex h-9 items-center rounded-sm border border-gray-200 bg-white px-4 text-[13.5px] font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export function BrandPanel({ editing }: { editing?: Brand }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(Boolean(editing))
  const action = saveBrand.bind(null, editing?.id ?? null)
  const [state, formAction] = useActionState(action, idleState)

  React.useEffect(() => setOpen(Boolean(editing)), [editing])

  React.useEffect(() => {
    if (state.status === 'success' && editing) {
      router.push('/admin/brands')
      router.refresh()
    }
  }, [state.status, editing, router])

  function close() {
    setOpen(false)
    if (editing) router.push('/admin/brands')
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 inline-flex h-9 items-center gap-2 rounded-sm bg-blue-600 px-4 text-[13.5px] font-semibold text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add brand
      </button>
    )
  }

  return (
    <div className="mb-4 rounded-md border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-bold text-gray-900">
          {editing ? `Edit ${editing.name}` : 'Add brand'}
        </h2>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-sm text-gray-400 hover:bg-gray-100"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <form action={formAction} className="flex flex-col gap-4" key={editing?.id ?? 'new'}>
        <FormBanner state={state} />

        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField label="Name" name="name" required error={fieldError(state, 'name')}>
            <AdminInput id="name" name="name" defaultValue={editing?.name} placeholder="Getz Pharma" required />
          </AdminField>
          <AdminField label="Slug" name="slug" error={fieldError(state, 'slug')} hint="Blank to generate">
            <AdminInput id="slug" name="slug" defaultValue={editing?.slug} placeholder="getz-pharma" />
          </AdminField>
        </div>

        <div className="flex gap-2">
          <SubmitButton pendingLabel="Saving…">{editing ? 'Save changes' : 'Create brand'}</SubmitButton>
          <button
            type="button"
            onClick={close}
            className="inline-flex h-9 items-center rounded-sm border border-gray-200 bg-white px-4 text-[13.5px] font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

/**
 * Delete button that surfaces the server's refusal inline.
 *
 * The server declines while products or children still reference the row —
 * mirroring `on delete restrict` — and the reason is shown next to the button
 * rather than swallowed.
 */
export function TaxonomyDeleteButton({
  kind,
  id,
  name,
  blocked,
}: {
  kind: 'category' | 'brand'
  id: string
  name: string
  blocked?: string
}) {
  const action = kind === 'category' ? deleteCategory : deleteBrand
  const [state, formAction] = useActionState(action, idleState)

  if (blocked) {
    return (
      <span
        title={blocked}
        className="cursor-not-allowed px-2 py-1 text-[12.5px] font-semibold text-gray-400"
      >
        In use
      </span>
    )
  }

  return (
    <form action={formAction} className="inline-flex flex-col items-end">
      <input type="hidden" name={kind === 'category' ? 'categoryId' : 'brandId'} value={id} />
      <SubmitButton
        variant="outline"
        pendingLabel="…"
        aria-label={`Delete ${name}`}
        className="h-8 border-transparent px-2 text-[12.5px] text-gray-500 hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      </SubmitButton>
      {state.status === 'error' && (
        <span role="alert" className="mt-1 max-w-48 text-right text-[11.5px] text-red-600">
          {state.message}
        </span>
      )}
    </form>
  )
}
