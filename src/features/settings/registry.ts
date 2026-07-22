import { z } from 'zod'
import { siteConfig } from '@/config/site'

/**
 * The typed settings registry (docs/SETTINGS.md): each key has a Zod schema
 * (the shape authority) and a code default (the fallback layer). A missing or
 * invalid database row can never blank the storefront — reads fall back here.
 */

export const businessInfoSchema = z.object({
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(160),
  phone: z.string().trim().min(7).max(20),
  email: z.string().trim().email(),
  address: z.string().trim().min(5).max(240),
})
export type BusinessInfo = z.infer<typeof businessInfoSchema>

export const storeStatusSchema = z.object({
  /** Pausing a vertical stops NEW orders/bookings; browsing stays live. */
  pharmacyOpen: z.boolean(),
  labOpen: z.boolean(),
  message: z.string().trim().max(200),
})
export type StoreStatus = z.infer<typeof storeStatusSchema>

export const SETTINGS = {
  'business.info': {
    schema: businessInfoSchema,
    defaults: {
      name: siteConfig.name,
      tagline: 'Medicines and lab tests, delivered.',
      phone: siteConfig.phone,
      email: siteConfig.email,
      address: siteConfig.address,
    } satisfies BusinessInfo,
  },
  'store.status': {
    schema: storeStatusSchema,
    defaults: { pharmacyOpen: true, labOpen: true, message: '' } satisfies StoreStatus,
  },
} as const

export type SettingKey = keyof typeof SETTINGS
