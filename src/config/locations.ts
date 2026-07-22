/**
 * Delivery coverage.
 *
 * Version 1 serves LAHORE ONLY — pharmacy delivery and lab bookings alike.
 * The model is city → areas so that expanding later is a data change (add a
 * city key with its areas), not a code change. Checkout offers an Area
 * dropdown scoped to the supported city; anything outside it is refused with
 * OUTSIDE_DELIVERY_MESSAGE.
 */

export const DELIVERY_AREAS_BY_CITY = {
  Lahore: [
    'DHA Phase 1',
    'DHA Phase 2',
    'DHA Phase 3',
    'DHA Phase 4',
    'DHA Phase 5',
    'DHA Phase 6',
    'DHA Phase 7',
    'DHA Phase 8',
    'DHA Phase 9',
    'Bahria Town',
    'Bahria Orchard',
    'Johar Town',
    'Wapda Town',
    'Model Town',
    'Garden Town',
    'Gulberg',
    'Gulshan-e-Ravi',
    'Faisal Town',
    'Township',
    'Valencia Town',
    'Lake City',
    'Askari',
    'Cantt',
    'Iqbal Town',
    'Sabzazar',
    'Allama Iqbal Town',
    'Shadman',
    'Samanabad',
    'Muslim Town',
    'Ichhra',
    'Garhi Shahu',
    'Jail Road',
    'Canal View',
    'Paragon City',
    'Eden City',
    'State Life Housing Society',
    'NFC Society',
    'LDA Avenue',
    'Raiwind Road',
    'Thokar Niaz Baig',
    'Chungi Amar Sidhu',
    'Harbanspura',
    'Mughalpura',
    'Shahdara',
    'Misri Shah',
  ],
} as const

export type DeliveryCity = keyof typeof DELIVERY_AREAS_BY_CITY

/** Cities the store currently serves. Version 1: Lahore only. */
export const SUPPORTED_CITIES = Object.keys(DELIVERY_AREAS_BY_CITY) as DeliveryCity[]

/** The single active delivery city, used wherever an order needs a city. */
export const DELIVERY_CITY: DeliveryCity = 'Lahore'

/** Province the delivery city belongs to — orders still record it. */
export const DELIVERY_PROVINCE = 'Punjab'

/** Shown whenever an address falls outside the supported coverage. */
export const OUTSIDE_DELIVERY_MESSAGE = 'Sorry, we currently deliver only within Lahore.'

export function areasFor(city: string): readonly string[] {
  return DELIVERY_AREAS_BY_CITY[city as DeliveryCity] ?? []
}

export function isDeliverableArea(area: string, city: string = DELIVERY_CITY): boolean {
  return areasFor(city).includes(area)
}

export const PAYMENT_METHODS = [
  {
    id: 'cod',
    label: 'Cash on delivery',
    detail: 'Pay the rider when your order arrives',
    icon: '💵',
    recommended: true,
    /** Bank transfer needs manual confirmation before dispatch. */
    requiresManualConfirmation: false,
  },
  {
    id: 'jazzcash',
    label: 'JazzCash',
    detail: 'Pay from your JazzCash mobile wallet',
    icon: '📱',
    recommended: false,
    requiresManualConfirmation: false,
  },
  {
    id: 'easypaisa',
    label: 'Easypaisa',
    detail: 'Pay from your Easypaisa mobile wallet',
    icon: '📱',
    recommended: false,
    requiresManualConfirmation: false,
  },
  {
    id: 'bank_transfer',
    label: 'Bank transfer',
    detail: 'Transfer to our account and send the receipt',
    icon: '🏦',
    recommended: false,
    requiresManualConfirmation: true,
  },
] as const

export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]['id']

/** Shown after checkout when bank transfer is chosen. */
export const BANK_DETAILS = {
  bankName: 'Meezan Bank',
  accountTitle: 'Sehat Store (Pvt) Ltd',
  accountNumber: '0102 0104 1234 5678',
  iban: 'PK36MEZN0001020104123456',
  branch: 'Shahrah-e-Faisal, Karachi',
} as const
