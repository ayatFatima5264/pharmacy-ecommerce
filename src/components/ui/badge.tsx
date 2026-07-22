import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Colour never carries meaning alone — every badge takes an icon or text label
 * alongside its tone (WCAG 1.4.1).
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-semibold',
  {
    variants: {
      tone: {
        rx: 'bg-amber-600/[0.12] text-amber-700',
        success: 'bg-green-50 text-green-700',
        info: 'bg-blue-50 text-blue-700',
        danger: 'bg-red-50 text-red-600',
        neutral: 'bg-gray-100 text-gray-500',
        sale: 'bg-red-50 text-red-600',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

export { badgeVariants }
