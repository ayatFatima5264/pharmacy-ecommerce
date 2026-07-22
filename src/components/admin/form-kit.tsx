'use client'

import * as React from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ActionState } from '@/features/catalog/actions/action-result'

/** Submit button wired to the enclosing form's pending state. */
export function SubmitButton({
  children,
  pendingLabel,
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: string
  variant?: 'primary' | 'danger' | 'outline'
}) {
  const { pending } = useFormStatus()

  const variantClass = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
  }[variant]

  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      aria-busy={pending || undefined}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-sm px-4 text-[13.5px] font-semibold',
        'transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-blue-600 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:border-transparent',
        variantClass,
        className,
      )}
      {...props}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  )
}

/**
 * Result banner. `role="status"` so success is announced; `role="alert"` so an
 * error interrupts — a silent failure at the top of a long form is invisible to
 * a screen reader user who is focused at the bottom.
 */
export function FormBanner({ state }: { state: ActionState }) {
  if (state.status === 'idle') return null

  const isError = state.status === 'error'

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={cn(
        'mb-4 flex items-start gap-2.5 rounded-sm p-3.5 text-[13.5px]',
        isError ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700',
      )}
    >
      {isError ? (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span>{state.message}</span>
    </div>
  )
}

export function fieldError(state: ActionState, key: string): string | undefined {
  return state.status === 'error' ? state.fieldErrors?.[key] : undefined
}

interface AdminFieldProps {
  label: string
  name: string
  error?: string
  hint?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

export function AdminField({
  label,
  name,
  error,
  hint,
  required,
  children,
  className,
}: AdminFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={name} className="text-[13px] font-semibold text-gray-700">
        {label}
        {required && (
          <span className="ml-0.5 text-red-600" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="text-[12.5px] text-gray-500">{hint}</p>}
      {error && (
        <p id={`${name}-error`} className="flex items-center gap-1.5 text-[12.5px] text-red-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}

const controlClass =
  'w-full rounded-sm border border-gray-200 bg-white px-3 text-[13.5px] text-gray-900 ' +
  'placeholder:text-gray-400 transition-colors duration-fast ' +
  'focus:border-blue-600 focus:outline-none focus:ring-[3px] focus:ring-blue-100 ' +
  'disabled:bg-gray-50 disabled:text-gray-400 aria-[invalid=true]:border-red-600'

export function AdminInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlClass, 'h-9', props.className)} />
}

export function AdminTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(controlClass, 'min-h-24 py-2', props.className)} />
}

export function AdminSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(controlClass, 'h-9 cursor-pointer pr-8', props.className)} />
}

export function AdminCheckbox({
  name,
  label,
  description,
  defaultChecked,
  checked,
  onChange,
}: {
  name: string
  label: string
  description?: string
  defaultChecked?: boolean
  checked?: boolean
  onChange?: (checked: boolean) => void
}) {
  return (
    <label htmlFor={name} className="flex cursor-pointer items-start gap-2.5">
      <input
        id={name}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        checked={checked}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded-[3px] border-gray-200 text-blue-600 focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
      />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-gray-900">{label}</span>
        {description && <span className="block text-[12.5px] text-gray-500">{description}</span>}
      </span>
    </label>
  )
}

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-md border border-gray-200 bg-white p-5', className)}>
      <h2 className="text-[14px] font-bold text-gray-900">{title}</h2>
      {description && <p className="mt-1 text-[12.5px] text-gray-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}
