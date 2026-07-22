import {
  BarChart3,
  Boxes,
  FileText,
  FlaskConical,
  Layers,
  LayoutDashboard,
  Microscope,
  Package,
  Settings,
  ShoppingBag,
  Tag,
  Tags,
  Truck,
  Users,
} from 'lucide-react'

/**
 * Grouped rather than a flat list of twelve. Twelve undifferentiated links is a
 * wall; labelled groups let staff find things by what they are doing.
 */
export const adminNav = [
  {
    group: null,
    items: [{ label: 'Dashboard', href: '/admin', icon: LayoutDashboard, exact: true }],
  },
  {
    group: 'Catalog',
    items: [
      { label: 'Products', href: '/admin/products', icon: Package },
      { label: 'Inventory', href: '/admin/inventory', icon: Layers },
      { label: 'Categories', href: '/admin/categories', icon: Boxes },
      { label: 'Brands', href: '/admin/brands', icon: Tags },
    ],
  },
  {
    group: 'Sales',
    items: [
      { label: 'Orders', href: '/admin/orders', icon: ShoppingBag, badge: 'awaitingRx' },
      { label: 'Customers', href: '/admin/customers', icon: Users },
      { label: 'Coupons', href: '/admin/coupons', icon: Tag },
      { label: 'Shipping', href: '/admin/shipping', icon: Truck },
    ],
  },
  {
    group: 'Diagnostics',
    items: [
      { label: 'Lab Tests', href: '/admin/lab-tests', icon: FlaskConical },
      { label: 'Lab Bookings', href: '/admin/lab-bookings', icon: Microscope, badge: 'pendingBookings' },
    ],
  },
  {
    group: 'Insights',
    items: [
      { label: 'Reports', href: '/admin/reports', icon: BarChart3 },
      { label: 'Content', href: '/admin/cms', icon: FileText },
      { label: 'Settings', href: '/admin/settings', icon: Settings },
    ],
  },
] as const

export type AdminBadgeKey = 'awaitingRx' | 'pendingBookings'
