import { z } from 'zod'
import { siteConfig, socialLinks } from '@/config/site'

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
  // V2 contact fields — optional with defaults so rows saved before V2 still
  // parse (safeParse would otherwise discard them for the code defaults).
  whatsapp: z.string().trim().max(20).default(siteConfig.whatsapp),
  hours: z.string().trim().max(120).default(siteConfig.hours),
  emergencyPhone: z.string().trim().max(20).default(''),
  /** Full Google Maps link shown on the contact surfaces. Blank = use the
   *  coordinates in config/site.ts. */
  mapsUrl: z.string().trim().url().or(z.literal('')).default(''),
})
export type BusinessInfo = z.infer<typeof businessInfoSchema>

export const storeStatusSchema = z.object({
  /** Pausing a vertical stops NEW orders/bookings; browsing stays live. */
  pharmacyOpen: z.boolean(),
  labOpen: z.boolean(),
  message: z.string().trim().max(200),
})
export type StoreStatus = z.infer<typeof storeStatusSchema>

/** The networks the storefront knows how to render (shared/social-icons.tsx). */
export const SOCIAL_NETWORKS = [
  'facebook',
  'instagram',
  'tiktok',
  'linkedin',
  'youtube',
  'whatsapp',
  'twitter',
  'pinterest',
] as const
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number]

const socialEntrySchema = z.object({
  url: z.string().trim().url().or(z.literal('')).or(z.literal('#')),
  enabled: z.boolean(),
})

export const socialLinksSchema = z.object(
  Object.fromEntries(SOCIAL_NETWORKS.map((network) => [network, socialEntrySchema])) as Record<
    SocialNetwork,
    typeof socialEntrySchema
  >,
)
export type SocialLinks = z.infer<typeof socialLinksSchema>

/** Defaults mirror config/site.ts placeholders; pinterest starts disabled. */
const socialDefaults = Object.fromEntries(
  SOCIAL_NETWORKS.map((network) => {
    const configured = socialLinks.find((link) => link.id === network)
    return [network, { url: configured?.href ?? '', enabled: Boolean(configured) }]
  }),
) as SocialLinks

export const SETTINGS = {
  'business.info': {
    schema: businessInfoSchema,
    defaults: businessInfoSchema.parse({
      name: siteConfig.name,
      tagline: 'Medicines and lab tests, delivered.',
      phone: siteConfig.phone,
      email: siteConfig.email,
      address: siteConfig.address,
    }),
  },
  'store.status': {
    schema: storeStatusSchema,
    defaults: { pharmacyOpen: true, labOpen: true, message: '' } satisfies StoreStatus,
  },
  'social.links': {
    schema: socialLinksSchema,
    defaults: socialDefaults,
  },
} as const

export type SettingKey = keyof typeof SETTINGS
