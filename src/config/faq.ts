import { siteConfig } from '@/config/site'

/**
 * FAQ content — one source feeding both the /faq page and its schema.org
 * FAQPage structured data, so the rich snippet can never drift from what the
 * page shows. Answers are plain text for exactly that reason (JSON-LD carries
 * no markup); links render separately on the page.
 */

export interface FaqItem {
  question: string
  answer: string
}

export interface FaqSection {
  id: string
  title: string
  items: FaqItem[]
}

export const faqSections: FaqSection[] = [
  {
    id: 'delivery',
    title: 'Delivery',
    items: [
      {
        question: 'Which areas of Lahore do you deliver to?',
        answer:
          'We currently deliver across Lahore only — including DHA (all phases), Bahria Town, Johar Town, Wapda Town, Model Town, Gulberg, Cantt, Askari, and many more areas. At checkout you pick your area from the list; if your area is not listed yet, contact us and we will let you know as soon as coverage reaches you.',
      },
      {
        question: 'What are your delivery timings?',
        answer: `We deliver every day during store hours (${siteConfig.hours.replace('Every day, ', '')}). Most orders placed before evening are delivered within 24–48 hours, and urgent medicine orders are prioritised.`,
      },
      {
        question: 'What are the delivery charges?',
        answer:
          'Delivery charges depend on your area and order size, and are always shown at checkout before you confirm the order — no surprises at the door.',
      },
    ],
  },
  {
    id: 'orders',
    title: 'Orders',
    items: [
      {
        question: 'How do I place an order?',
        answer:
          'Browse the pharmacy or search for your medicine, add items to your cart, and check out with your delivery address and preferred payment method. You can order as a guest or create an account to track everything in one place. If any item needs a prescription, you will be asked to upload it during checkout.',
      },
      {
        question: 'Can I cancel an order?',
        answer:
          'Yes — contact us as soon as possible with your order number. Orders can be cancelled any time before they are dispatched. Once an order is out for delivery it can no longer be cancelled, but you can refuse the delivery and the return policy applies.',
      },
      {
        question: 'How can I track my order?',
        answer:
          'Use the Track Order page with your order number and phone number, or sign in and open My Orders to see live status for every order — from confirmation to delivery.',
      },
    ],
  },
  {
    id: 'prescription',
    title: 'Prescriptions',
    items: [
      {
        question: 'Which medicines require a prescription?',
        answer:
          'Medicines marked with an "Rx" badge require a valid doctor\'s prescription under DRAP regulations. Over-the-counter items, wellness products, and medical devices do not. Every prescription we receive is verified by our licensed pharmacist before the order is confirmed.',
      },
      {
        question: 'How do I upload my prescription?',
        answer:
          'When your cart contains a prescription item, checkout asks you to attach a clear photo or scan of your prescription. Make sure the doctor\'s name, date, and medicine names are readable. Our pharmacist reviews it and your order proceeds once it is approved.',
      },
    ],
  },
  {
    id: 'lab-tests',
    title: 'Lab Tests',
    items: [
      {
        question: 'How do I book a lab test?',
        answer:
          'Choose a test or health package from the Lab Tests section, add it to your cart, and pick a convenient sample-collection slot at checkout. A trained phlebotomist collects your sample at home — no queueing at the lab.',
      },
      {
        question: 'When will I receive my report?',
        answer:
          'Most reports are ready within 24–48 hours of sample collection; each test page shows its exact turnaround time. Your report is delivered digitally, and you can also access it from your account.',
      },
    ],
  },
  {
    id: 'payments',
    title: 'Payments',
    items: [
      {
        question: 'Which payment methods are supported?',
        answer:
          'We accept Cash on Delivery, JazzCash, Easypaisa, and bank transfer. Cash on Delivery is available on all orders — you pay the rider when your order arrives.',
      },
    ],
  },
  {
    id: 'returns',
    title: 'Returns & Refunds',
    items: [
      {
        question: 'What is your return policy?',
        answer:
          'Wrongly delivered, damaged, or expired items are replaced or refunded — contact us within 7 days of delivery with your order number. For safety and regulatory reasons, medicines that have left the store in good condition cannot be resold, so correct items in opened packaging cannot be returned. Full details are on our Return Policy page.',
      },
      {
        question: 'How do refunds work?',
        answer:
          'Approved refunds are issued to your original payment method — or as a bank/wallet transfer for Cash on Delivery orders — within 5–7 working days of the return being confirmed.',
      },
    ],
  },
]
