'use client'

import * as React from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Form primitives.
 *
 * Labels are always visible — placeholder-as-label fails accessibility and
 * disappears exactly when the user needs it. Errors are tied via
 * aria-describedby and paired with an icon, never signalled by colour alone.
 */

const baseControl =
  'w-full rounded-sm border border-gray-200 bg-white px-3.5 text-base text-gray-900 ' +
  'placeholder:text-gray-400 transition-colors duration-fast ' +
  'focus:border-blue-600 focus:outline-none focus:ring-[3px] focus:ring-blue-100 ' +
  'disabled:bg-gray-50 disabled:text-gray-400 ' +
  'aria-[invalid=true]:border-red-600 aria-[invalid=true]:focus:ring-red-50'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(baseControl, 'h-11', className)} {...props} />
  ),
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(baseControl, 'min-h-[112px] py-3', className)} {...props} />
))
Textarea.displayName = 'Textarea'

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(baseControl, 'h-11 cursor-pointer pr-9', className)} {...props}>
    {children}
  </select>
))
Select.displayName = 'Select'

interface FieldProps {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

export function Field({ label, htmlFor, error, hint, required, children, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-body-sm font-semibold text-gray-700">
        {label}
        {required && (
          <span className="ml-0.5 text-red-600" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="text-body-sm text-gray-500">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} className="flex items-center gap-1.5 text-body-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}
