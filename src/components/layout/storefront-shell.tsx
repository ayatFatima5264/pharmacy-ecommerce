import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { BottomNav } from '@/components/layout/bottom-nav'
import { CartProvider } from '@/features/cart/cart-context'
import { getCartCatalog } from '@/features/cart/catalog-snapshot'

/**
 * The customer-facing shell. Shared by the (shop) and (marketing) route groups
 * so both get identical chrome from one definition.
 *
 * The catalog snapshot is resolved here, on the server, and handed to the cart
 * provider. That is what lets the cart price itself from live data instead of
 * from whatever it wrote to localStorage days ago.
 */
export async function StorefrontShell({ children }: { children: React.ReactNode }) {
  const catalog = await getCartCatalog()

  return (
    <CartProvider catalog={catalog}>
      <div className="flex min-h-screen flex-col bg-white">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Header />
        {/* pb-14 clears the fixed mobile bottom nav. */}
        <main id="main" className="flex-1 pb-14 md:pb-0">
          {children}
        </main>
        <Footer />
        <BottomNav />
      </div>
    </CartProvider>
  )
}
