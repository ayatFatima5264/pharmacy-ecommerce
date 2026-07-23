import { WhatsAppIcon } from '@/components/shared/social-icons'
import { whatsappLink } from '@/lib/whatsapp'

/**
 * Floating WhatsApp chat button, mounted once in the storefront shell so every
 * public page carries it. A plain anchor — no client JS: the animation is CSS
 * and the chat opens in WhatsApp itself.
 *
 * Position: above the fixed mobile bottom nav (h-14 → bottom-[4.5rem]), and in
 * the usual bottom-right corner on desktop where the nav does not exist.
 */
export function WhatsAppButton() {
  return (
    <a
      href={whatsappLink()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      title="Chat with us on WhatsApp"
      className="group fixed bottom-[4.5rem] right-4 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-green-600 text-white shadow-e3 transition-all duration-medium animate-fade-in hover:scale-105 hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:scale-100 md:bottom-6 md:right-6 md:h-14 md:w-14"
    >
      {/* Soft pulse halo — decorative, hidden from AT, disabled for reduced motion. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 animate-ping rounded-full bg-green-600/30 [animation-duration:2.5s] motion-reduce:hidden"
      />
      <WhatsAppIcon className="h-6 w-6 md:h-7 md:w-7" />
    </a>
  )
}
