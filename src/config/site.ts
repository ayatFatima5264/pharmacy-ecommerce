export const siteConfig = {
  name: 'AR Medical Store',
  tagline: 'Your trusted online medical store & lab',
  description:
    'Genuine medicines, lab tests, and health packages delivered across Lahore. DRAP-licensed medical store with pharmacist-verified prescriptions and cash on delivery.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  /** Brand mark shipped in /public — used by the header, auth pages, and admin. */
  logo: '/logo.png',
  phone: '+92 21 111 734 728',
  email: 'care@armedicalstore.pk',
  address: 'Plot 24, Shahrah-e-Faisal, Karachi, Sindh 75350',
  drapLicense: 'DRAP-PH-2024-11482',
  pharmacist: 'Dr. Ayesha Siddiqui, Pharm-D (PCP Reg. 41209)',
  hours: 'Every day, 9:00 AM – 11:00 PM',
} as const

export const mainNav = [
  { label: 'Home', href: '/' },
  { label: 'Pharmacy', href: '/pharmacy' },
  { label: 'Lab Tests', href: '/lab-tests' },
  { label: 'Health Packages', href: '/health-packages' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
] as const

/**
 * Social profiles shown in the footer. Placeholder "#" links until the real
 * profile URLs exist — swap them here, nowhere else.
 */
export const socialLinks = [
  { id: 'facebook', label: 'Facebook', href: '#' },
  { id: 'instagram', label: 'Instagram', href: '#' },
  { id: 'linkedin', label: 'LinkedIn', href: '#' },
  { id: 'youtube', label: 'YouTube', href: '#' },
  { id: 'tiktok', label: 'TikTok', href: '#' },
  { id: 'whatsapp', label: 'WhatsApp', href: '#' },
  { id: 'twitter', label: 'Twitter / X', href: '#' },
] as const

export const footerNav = [
  {
    title: 'Shop',
    links: [
      { label: 'All medicines', href: '/pharmacy' },
      { label: 'Pain relief', href: '/categories/pain-relief' },
      { label: 'Diabetes care', href: '/categories/diabetes-care' },
      { label: 'Medical devices', href: '/categories/medical-devices' },
      { label: 'Vitamins', href: '/categories/vitamins-supplements' },
    ],
  },
  {
    title: 'Diagnostics',
    links: [
      { label: 'All lab tests', href: '/lab-tests' },
      { label: 'Health packages', href: '/health-packages' },
      { label: 'Full body checkup', href: '/health-packages/full-body-checkup' },
      { label: 'Diabetes screening', href: '/health-packages/diabetes-screening' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About us', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Track order', href: '/track-order' },
    ],
  },
  {
    title: 'Policies',
    links: [
      { label: 'Privacy policy', href: '/policies/privacy' },
      { label: 'Terms of service', href: '/policies/terms' },
      { label: 'Shipping policy', href: '/policies/shipping' },
      { label: 'Return policy', href: '/policies/returns' },
    ],
  },
] as const

/**
 * City list used ONLY by admin filters (orders/customers/reports may hold
 * historical data from before the Lahore-only change). Customer-facing
 * delivery coverage lives in config/locations.ts and is Lahore-only.
 */
export const cities = [
  'Karachi',
  'Lahore',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Peshawar',
  'Quetta',
  'Hyderabad',
  'Sialkot',
] as const
