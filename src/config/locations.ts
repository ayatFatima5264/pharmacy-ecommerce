/**
 * Pakistani provinces and the cities we deliver to.
 *
 * City is scoped to province so the two can never disagree — a cascading
 * select is the only way to stop "Lahore, Sindh" reaching a courier label.
 */

export const PROVINCES = [
  'Punjab',
  'Sindh',
  'Khyber Pakhtunkhwa',
  'Balochistan',
  'Islamabad Capital Territory',
  'Gilgit-Baltistan',
  'Azad Jammu & Kashmir',
] as const

export type Province = (typeof PROVINCES)[number]

export const CITIES_BY_PROVINCE: Record<Province, string[]> = {
  Punjab: ['Lahore', 'Faisalabad', 'Rawalpindi', 'Multan', 'Gujranwala', 'Sialkot'],
  Sindh: ['Karachi', 'Hyderabad', 'Sukkur', 'Larkana'],
  'Khyber Pakhtunkhwa': ['Peshawar', 'Abbottabad'],
  Balochistan: ['Quetta'],
  'Islamabad Capital Territory': ['Islamabad'],
  'Gilgit-Baltistan': ['Gilgit', 'Skardu'],
  'Azad Jammu & Kashmir': ['Muzaffarabad'],
}

export const ALL_CITIES = Object.values(CITIES_BY_PROVINCE).flat()

export function citiesFor(province: string): string[] {
  return CITIES_BY_PROVINCE[province as Province] ?? []
}

export function isCityInProvince(city: string, province: string): boolean {
  return citiesFor(province).includes(city)
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
