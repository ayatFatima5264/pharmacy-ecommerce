import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md font-semibold ' +
    'transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-blue-600 focus-visible:ring-offset-2 ' +
    'disabled:pointer-events-none disabled:bg-gray-100 disabled:text-gray-400 disabled:border-transparent',
  {
    variants: {
      variant: {
        primary: 'bg-blue-600 text-white hover:bg-blue-700',
        secondary: 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50',
        ghost: 'text-gray-700 hover:bg-gray-100',
        danger: 'bg-red-600 text-white hover:bg-red-700',
        outline: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
      },
      size: {
        sm: 'h-9 px-3.5 text-body-sm',
        md: 'h-11 px-5 text-[15px]',
        lg: 'h-13 px-6 text-base',
      },
      full: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', full: false },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

/**
 * Async buttons keep their width while loading so the layout does not jump,
 * and set aria-busy — the primary anti-double-submit control in checkout.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, full, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, full }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  ),
)
Button.displayName = 'Button'

export { Button, buttonVariants }
