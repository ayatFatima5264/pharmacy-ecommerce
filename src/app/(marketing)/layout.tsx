import { StorefrontShell } from '@/components/layout/storefront-shell'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <StorefrontShell>{children}</StorefrontShell>
}
