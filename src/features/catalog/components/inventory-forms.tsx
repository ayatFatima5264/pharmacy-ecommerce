'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import {
  AdminField,
  AdminInput,
  AdminSelect,
  FormBanner,
  SubmitButton,
  fieldError,
} from '@/components/admin/form-kit'
import { adjustStock, createBatch, writeOffExpired } from '@/features/catalog/actions/inventory-actions'
import { idleState } from '@/features/catalog/actions/action-result'
import { cn } from '@/lib/utils'

interface VariantOption {
  productId: string
  productName: string
  variants: { id: string; label: string }[]
}

export function ReceiveBatchForm({
  options,
  pharmacies,
}: {
  options: VariantOption[]
  pharmacies: readonly string[]
}) {
  const [open, setOpen] = React.useState(false)
  const [state, formAction] = useActionState(createBatch, idleState)
  const [productId, setProductId] = React.useState(options[0]?.productId ?? '')

  // Pack sizes belong to a product, so the second select is driven by the
  // first — offering every SKU in the catalog would invite mismatches.
  const variants = options.find((o) => o.productId === productId)?.variants ?? []

  // Collapse once the batch is accepted.
  React.useEffect(() => {
    if (state.status === 'success') setOpen(false)
  }, [state.status])

  if (!open) {
    return (
      <div className="mb-4">
        {state.status === 'success' && <FormBanner state={state} />}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 items-center gap-2 rounded-sm bg-blue-600 px-4 text-[13.5px] font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Receive stock
        </button>
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-md border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-bold text-gray-900">Receive stock</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-sm text-gray-400 hover:bg-gray-100"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <FormBanner state={state} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AdminField label="Product" name="productId" required error={fieldError(state, 'productId')}>
            <AdminSelect
              id="productId"
              name="productId"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
            >
              {options.map((option) => (
                <option key={option.productId} value={option.productId}>
                  {option.productName}
                </option>
              ))}
            </AdminSelect>
          </AdminField>

          <AdminField label="Pack size" name="variantId" required error={fieldError(state, 'variantId')}>
            <AdminSelect id="variantId" name="variantId" required key={productId}>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.label}
                </option>
              ))}
            </AdminSelect>
          </AdminField>

          <AdminField
            label="Batch number"
            name="batchNumber"
            required
            error={fieldError(state, 'batchNumber')}
          >
            <AdminInput
              id="batchNumber"
              name="batchNumber"
              placeholder="B-2291"
              className="tabular uppercase"
              required
            />
          </AdminField>

          <AdminField label="Branch" name="pharmacy" required error={fieldError(state, 'pharmacy')}>
            <AdminSelect id="pharmacy" name="pharmacy" required>
              {pharmacies.map((pharmacy) => (
                <option key={pharmacy} value={pharmacy}>
                  {pharmacy}
                </option>
              ))}
            </AdminSelect>
          </AdminField>

          <AdminField
            label="Expiry date"
            name="expiryDate"
            required
            error={fieldError(state, 'expiryDate')}
            hint="Must be in the future"
          >
            <AdminInput id="expiryDate" name="expiryDate" type="date" required />
          </AdminField>

          <AdminField
            label="Quantity received"
            name="quantityOnHand"
            required
            error={fieldError(state, 'quantityOnHand')}
          >
            <AdminInput
              id="quantityOnHand"
              name="quantityOnHand"
              inputMode="numeric"
              placeholder="500"
              className="tabular"
              required
            />
          </AdminField>
        </div>

        <input type="hidden" name="quantityReserved" value="0" />

        <div className="flex gap-2">
          <SubmitButton pendingLabel="Receiving…">Receive batch</SubmitButton>
          <button
            type="button"
            onClick={() => setOpen(false)}
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
 * Signed stock adjustment. Every change carries a reason, because this stands
 * in for a `stock_movements` ledger row — an unexplained quantity change is
 * exactly what makes a stock discrepancy impossible to investigate later.
 */
export function AdjustStockDialog({
  batchId,
  batchNumber,
  productName,
  onHand,
  reserved,
}: {
  batchId: string
  batchNumber: string
  productName: string
  onHand: number
  reserved: number
}) {
  const [open, setOpen] = React.useState(false)
  const [state, formAction] = useActionState(adjustStock, idleState)
  const [delta, setDelta] = React.useState('')

  React.useEffect(() => {
    if (state.status === 'success') {
      setOpen(false)
      setDelta('')
    }
  }, [state.status])

  const parsed = Number.parseInt(delta, 10)
  const projected = Number.isFinite(parsed) ? onHand + parsed : onHand
  const invalidProjection = projected < 0 || projected < reserved

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-sm px-2 py-1 text-[12.5px] font-semibold text-blue-600 hover:bg-blue-50"
      >
        Adjust
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-gray-900/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="adjust-title"
            className="relative w-full max-w-md rounded-t-lg bg-white p-5 sm:rounded-lg"
          >
            <div className="mb-4">
              <h2 id="adjust-title" className="text-[15px] font-bold text-gray-900">
                Adjust stock
              </h2>
              <p className="tabular mt-0.5 text-[13px] text-gray-500">
                {batchNumber} · {productName} · {onHand.toLocaleString('en-PK')} on hand
                {reserved > 0 && `, ${reserved} reserved`}
              </p>
            </div>

            <form action={formAction} className="flex flex-col gap-4">
              <FormBanner state={state} />
              <input type="hidden" name="batchId" value={batchId} />

              <AdminField
                label="Adjustment"
                name="delta"
                required
                error={fieldError(state, 'delta')}
                hint="Positive to add, negative to remove"
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDelta((d) => String((Number.parseInt(d, 10) || 0) - 10))}
                    aria-label="Decrease by 10"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-gray-200 text-gray-700 hover:bg-gray-50"
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <AdminInput
                    id="delta"
                    name="delta"
                    value={delta}
                    onChange={(e) => setDelta(e.target.value)}
                    inputMode="numeric"
                    placeholder="-25"
                    className="tabular text-center"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setDelta((d) => String((Number.parseInt(d, 10) || 0) + 10))}
                    aria-label="Increase by 10"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-gray-200 text-gray-700 hover:bg-gray-50"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </AdminField>

              <AdminField label="Reason" name="reason" required error={fieldError(state, 'reason')}>
                <AdminSelect id="reason" name="reason" defaultValue="adjustment" required>
                  <option value="purchase">Purchase — stock received</option>
                  <option value="return">Return — customer returned</option>
                  <option value="damage">Damage — broken or unsellable</option>
                  <option value="expiry">Expiry — written off</option>
                  <option value="adjustment">Adjustment — stock count correction</option>
                </AdminSelect>
              </AdminField>

              <AdminField label="Note" name="note" error={fieldError(state, 'note')}>
                <AdminInput id="note" name="note" placeholder="Optional detail for the audit trail" />
              </AdminField>

              {delta !== '' && Number.isFinite(parsed) && (
                <p
                  className={cn(
                    'tabular rounded-sm px-3 py-2 text-[12.5px] font-semibold',
                    invalidProjection ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-700',
                  )}
                >
                  {invalidProjection
                    ? projected < 0
                      ? `Only ${onHand} units on hand — this would go below zero.`
                      : `${reserved} units are reserved for open orders.`
                    : `New quantity on hand: ${projected.toLocaleString('en-PK')}`}
                </p>
              )}

              <div className="flex gap-2">
                <SubmitButton disabled={invalidProjection} pendingLabel="Saving…">
                  Apply adjustment
                </SubmitButton>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-9 items-center rounded-sm border border-gray-200 bg-white px-4 text-[13.5px] font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export function WriteOffButton({ batchId, units }: { batchId: string; units: number }) {
  const [state, formAction] = useActionState(writeOffExpired, idleState)

  if (units === 0) {
    return <span className="px-2 text-[12.5px] text-gray-400">Written off</span>
  }

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="batchId" value={batchId} />
      <SubmitButton
        variant="outline"
        pendingLabel="…"
        className="h-8 border-red-600/30 px-2.5 text-[12.5px] text-red-600 hover:bg-red-50"
        title={state.status === 'error' ? state.message : undefined}
      >
        Write off
      </SubmitButton>
    </form>
  )
}
