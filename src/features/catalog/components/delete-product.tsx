'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import {
  AdminCheckbox,
  AdminField,
  AdminInput,
  FormBanner,
  SubmitButton,
  fieldError,
} from '@/components/admin/form-kit'
import { deleteProduct } from '@/features/catalog/actions/product-actions'
import { idleState } from '@/features/catalog/actions/action-result'

/**
 * Destructive action with a typed confirmation.
 *
 * Deleting a catalog row also drops its inventory batches, so a plain "Are you
 * sure?" is too weak a gate — the operator has to type the product name. The
 * same check runs again on the server; this dialog is convenience, not control.
 */
export function DeleteProduct({
  productId,
  productName,
  stockOnHand,
}: {
  productId: string
  productName: string
  stockOnHand: number
}) {
  const [open, setOpen] = React.useState(false)
  const [state, formAction] = useActionState(deleteProduct, idleState)
  const [typed, setTyped] = React.useState('')

  const matches = typed.trim() === productName

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-sm border border-gray-200 bg-white px-4 text-[13.5px] font-semibold text-red-600 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Delete product
      </button>
    )
  }

  return (
    <div className="rounded-md border border-red-600/30 bg-red-50 p-5">
      <div className="mb-4 flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
        <div>
          <h3 className="text-[14px] font-bold text-red-700">Delete {productName}?</h3>
          <p className="mt-1 text-[13px] text-red-700/90">
            This removes the product from the storefront and deletes its inventory batches.
            {stockOnHand > 0 && (
              <>
                {' '}
                <strong className="font-semibold">
                  {stockOnHand.toLocaleString('en-PK')} units are still on hand.
                </strong>
              </>
            )}{' '}
            Past orders keep their own snapshot and are unaffected.
          </p>
        </div>
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <FormBanner state={state} />
        <input type="hidden" name="productId" value={productId} />

        <AdminField
          label={`Type "${productName}" to confirm`}
          name="confirmName"
          error={fieldError(state, 'confirmName')}
          required
        >
          <AdminInput
            id="confirmName"
            name="confirmName"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="bg-white"
          />
        </AdminField>

        {stockOnHand > 0 && (
          <AdminCheckbox
            name="force"
            label="Delete anyway, discarding the remaining stock"
            description="Normally you would write the stock off first so it appears in inventory reports."
          />
        )}

        <div className="mt-1 flex flex-wrap gap-2">
          <SubmitButton variant="danger" disabled={!matches} pendingLabel="Deleting…">
            Delete permanently
          </SubmitButton>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setTyped('')
            }}
            className="inline-flex h-9 items-center rounded-sm border border-gray-200 bg-white px-4 text-[13.5px] font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
