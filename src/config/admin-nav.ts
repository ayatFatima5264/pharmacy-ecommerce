import {
  BarChart3,
  Boxes,
  ClipboardCheck,
  Contact,
  FileText,
  FlaskConical,
  Layers,
  LayoutDashboard,
  Microscope,
  Package,
  Settings,
  Share2,
  ShoppingBag,
  Star,
  Tag,
  Tags,
  Truck,
  UserCog,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Grouped, with one level of children for modules that have workflows
 * (Products: browse / add / bulk edit / import). Children reuse EXISTING
 * routes — "Import Excel" is the /admin/imports feature, not a new page.
 */

export interface AdminNavChild {
  label: string
  href: string
  exact?: boolean
}

export interface AdminNavItem {
  label: string
  href: string
  icon: LucideIcon
  exact?: boolean
  badge?: AdminBadgeKey
  children?: readonly AdminNavChild[]
}

export interface AdminNavSection {
  group: string | null
  items: readonly AdminNavItem[]
}

export const adminNav: readonly AdminNavSection[] = [
  {
    group: null,
    items: [{ label: 'Dashboard', href: '/admin', icon: LayoutDashboard, exact: true }],
  },
  {
    group: 'Catalog',
    items: [
      {
        label: 'Products',
        href: '/admin/products',
        icon: Package,
        children: [
          { label: 'All Products', href: '/admin/products', exact: true },
          { label: 'Add Product', href: '/admin/products/new' },
          { label: 'Bulk Edit', href: '/admin/products/bulk' },
          { label: 'Import Excel', href: '/admin/imports' },
        ],
      },
      { label: 'Categories', href: '/admin/categories', icon: Boxes },
      { label: 'Brands', href: '/admin/brands', icon: Tags },
      { label: 'Inventory', href: '/admin/inventory', icon: Layers },
    ],
  },
  {
    group: 'Sales',
    items: [
      { label: 'Orders', href: '/admin/orders', icon: ShoppingBag },
      { label: 'Prescriptions', href: '/admin/prescriptions', icon: ClipboardCheck, badge: 'awaitingRx' },
      { label: 'Customers', href: '/admin/customers', icon: Users },
      { label: 'Reviews', href: '/admin/reviews', icon: Star },
      { label: 'Coupons', href: '/admin/coupons', icon: Tag },
      { label: 'Shipping', href: '/admin/shipping', icon: Truck },
    ],
  },
  {
    group: 'Diagnostics',
    items: [
      {
        label: 'Lab Tests',
        href: '/admin/lab-tests',
        icon: FlaskConical,
        children: [
          { label: 'All Tests', href: '/admin/lab-tests', exact: true },
          { label: 'Import Excel', href: '/admin/imports' },
        ],
      },
      { label: 'Lab Bookings', href: '/admin/lab-bookings', icon: Microscope, badge: 'pendingBookings' },
    ],
  },
  {
    group: 'Content Management',
    items: [
      { label: 'Pages', href: '/admin/cms', icon: FileText },
      { label: 'Contact Information', href: '/admin/content/contact', icon: Contact },
      { label: 'Social Media', href: '/admin/content/social', icon: Share2 },
    ],
  },
  {
    group: 'System',
    items: [
      { label: 'Reports', href: '/admin/reports', icon: BarChart3 },
      { label: 'Users & Roles', href: '/admin/users', icon: UserCog },
      { label: 'Settings', href: '/admin/settings', icon: Settings },
    ],
  },
] as const

export type AdminBadgeKey = 'awaitingRx' | 'pendingBookings'
