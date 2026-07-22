import { z } from 'zod'
import { DELIVERY_CITY, OUTSIDE_DELIVERY_MESSAGE, isDeliverableArea } from '@/config/locations'

/**
 * Checkout validation. One schema for the form and for the Server Action —
 * client validation is UX, the server run is the security boundary.
 */

const cartRefSchema = z.object({
  kind: z.enum(['product', 'test', 'package']),
  slug: z.string().trim().min(1),
  variantId: z.string().trim().optional(),
  quantity: z.number().int().positive().max(99),
})

export const checkoutSchema = z
  .object({
    firstName: z.string().trim().min(2, 'Enter your first name').max(50),
    lastName: z.string().trim().min(2, 'Enter your last name').max(50),

    // Pakistani mobile: 03XXXXXXXXX or +923XXXXXXXXX.
    phone: z
      .string()
      .trim()
      .regex(/^(?:\+92|0)3\d{9}$/, 'Enter a valid mobile number, e.g. 03001234567'),

    email: z
      .string()
      .trim()
      .max(120)
      .refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email address')
      .optional()
      .default(''),

    // Lahore-only in Version 1: the customer picks an AREA, not a city. An
    // area outside the supported list is refused with the coverage message.
    area: z
      .string()
      .trim()
      .refine((v) => isDeliverableArea(v, DELIVERY_CITY), OUTSIDE_DELIVERY_MESSAGE),
    address: z.string().trim().min(10, 'Enter your full street address').max(200),
    postalCode: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\d{5}$/.test(v), 'Postal code is 5 digits')
      .optional()
      .default(''),

    notes: z.string().trim().max(300, 'Keep notes under 300 characters').optional().default(''),

    paymentMethod: z.enum(['cod', 'jazzcash', 'easypaisa', 'bank_transfer'], {
      errorMap: () => ({ message: 'Choose a payment method' }),
    }),

    couponCode: z.string().trim().max(40).optional().default(''),

    /** Cart contents are sent as refs — never prices. The server prices them. */
    items: z.array(cartRefSchema).min(1, 'Your cart is empty'),

    /** Dedupes a retried submission into one order. */
    idempotencyKey: z.string().trim().min(8).max(64),
  })

export type CheckoutValues = z.infer<typeof checkoutSchema>
export type CheckoutInput = z.input<typeof checkoutSchema>
