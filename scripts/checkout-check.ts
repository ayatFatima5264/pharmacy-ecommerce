/**
 * Verification for the checkout flow.
 * Run with: npm run check:checkout
 *
 * Uses --conditions=react-server so `server-only` resolves to its empty stub
 * instead of throwing, which lets the store and email templates be tested here.
 */
import { checkoutSchema } from '../src/features/checkout/schemas/checkout-schema'
import { citiesFor, isCityInProvince, PAYMENT_METHODS } from '../src/config/locations'
import {
  findOrderByIdempotencyKey,
  findOrderByNumber,
  findOrderForTracking,
  insertOrder,
  nextOrderNumber,
  type PlacedOrder,
} from '../src/lib/data/orders-store'
import {
  orderConfirmationHtml,
  orderConfirmationSubject,
  orderConfirmationText,
} from '../src/lib/email/order-confirmation'

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail = '') {
  if (condition) { passed++; console.log(`  PASS  ${name}`) }
  else { failed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}

const validForm = {
  firstName: 'Ahmed',
  lastName: 'Khan',
  phone: '03001234567',
  email: 'ahmed@example.pk',
  province: 'Sindh',
  city: 'Karachi',
  address: 'House 12, Block B, DHA Phase 5',
  postalCode: '75500',
  notes: 'Ring the bell twice',
  paymentMethod: 'cod',
  couponCode: '',
  idempotencyKey: 'abcd1234efgh5678',
  items: [{ kind: 'product' as const, slug: 'panadol-extra-500mg', variantId: 'v1a', quantity: 2 }],
}

console.log('\nRequired fields')
{
  check('valid submission accepted', checkoutSchema.safeParse(validForm).success)

  for (const field of ['firstName', 'lastName', 'phone', 'address'] as const) {
    const r = checkoutSchema.safeParse({ ...validForm, [field]: '' })
    check(`missing ${field} rejected`, !r.success)
  }

  check('empty cart rejected', !checkoutSchema.safeParse({ ...validForm, items: [] }).success)
  check('missing idempotency key rejected',
    !checkoutSchema.safeParse({ ...validForm, idempotencyKey: '' }).success)
}

console.log('\nPhone')
{
  for (const phone of ['03001234567', '+923001234567']) {
    check(`${phone} accepted`, checkoutSchema.safeParse({ ...validForm, phone }).success)
  }
  for (const phone of ['0300123456', '021111734728', '3001234567', 'not-a-phone']) {
    check(`${phone} rejected`, !checkoutSchema.safeParse({ ...validForm, phone }).success)
  }
}

console.log('\nProvince and city consistency')
{
  check('Karachi is in Sindh', isCityInProvince('Karachi', 'Sindh'))
  check('Lahore is NOT in Sindh', !isCityInProvince('Lahore', 'Sindh'))
  check('Punjab lists Lahore', citiesFor('Punjab').includes('Lahore'))

  const mismatch = checkoutSchema.safeParse({ ...validForm, province: 'Punjab', city: 'Karachi' })
  check('city outside the chosen province rejected', !mismatch.success)
  check('mismatch error is attached to the city field',
    !mismatch.success && mismatch.error.issues.some((i) => i.path.includes('city')))

  const valid = checkoutSchema.safeParse({ ...validForm, province: 'Punjab', city: 'Lahore' })
  check('matching province/city accepted', valid.success)

  const unknownCity = checkoutSchema.safeParse({ ...validForm, city: 'Atlantis' })
  check('undeliverable city rejected', !unknownCity.success)
}

console.log('\nOptional fields')
{
  check('blank email accepted', checkoutSchema.safeParse({ ...validForm, email: '' }).success)
  check('malformed email rejected',
    !checkoutSchema.safeParse({ ...validForm, email: 'not-an-email' }).success)
  check('blank postal code accepted', checkoutSchema.safeParse({ ...validForm, postalCode: '' }).success)
  check('4-digit postal code rejected',
    !checkoutSchema.safeParse({ ...validForm, postalCode: '7550' }).success)
  check('5-digit postal code accepted',
    checkoutSchema.safeParse({ ...validForm, postalCode: '75500' }).success)
  check('over-long notes rejected',
    !checkoutSchema.safeParse({ ...validForm, notes: 'x'.repeat(301) }).success)
}

console.log('\nPayment methods')
{
  const ids = PAYMENT_METHODS.map((m) => m.id)
  check('all four methods offered', ids.length === 4)
  for (const id of ['cod', 'jazzcash', 'easypaisa', 'bank_transfer']) {
    check(`${id} accepted`, checkoutSchema.safeParse({ ...validForm, paymentMethod: id }).success)
  }
  check('unknown payment method rejected',
    !checkoutSchema.safeParse({ ...validForm, paymentMethod: 'bitcoin' }).success)
  check('cash on delivery is listed first', ids[0] === 'cod')
}

console.log('\nClient cannot supply prices')
{
  const parsed = checkoutSchema.safeParse({
    ...validForm,
    // A hostile client trying to dictate money.
    totalPaisa: 1,
    items: [{ kind: 'product', slug: 'panadol-extra-500mg', variantId: 'v1a', quantity: 2, unitPricePaisa: 1 }],
  } as never)
  check('submission parses', parsed.success)
  check('no price field survives parsing of an item',
    parsed.success && !('unitPricePaisa' in (parsed.data.items[0] as object)),
    parsed.success ? JSON.stringify(parsed.data.items[0]) : '')
  check('no total field survives parsing',
    parsed.success && !('totalPaisa' in (parsed.data as object)))
}

console.log('\nOrder numbers')
{
  const a = nextOrderNumber()
  const b = nextOrderNumber()
  check('order numbers use the HC- prefix', a.startsWith('HC-'))
  check('order numbers are unique', a !== b)
  check('order numbers increase monotonically',
    Number(b.slice(3)) === Number(a.slice(3)) + 1, `${a} then ${b}`)
}

function makeOrder(over: Partial<PlacedOrder> = {}): PlacedOrder {
  return {
    id: crypto.randomUUID(),
    orderNumber: nextOrderNumber(),
    placedAt: new Date().toISOString(),
    status: 'confirmed',
    firstName: 'Ahmed', lastName: 'Khan', phone: '03001234567', email: 'ahmed@example.pk',
    province: 'Sindh', city: 'Karachi', address: 'House 12, Block B', postalCode: '75500',
    notes: null, paymentMethod: 'cod', paymentStatus: 'pending',
    items: [{
      kind: 'product', slug: 'panadol-extra-500mg', variantId: 'v1a',
      name: 'Panadol Extra 500mg', subtitle: 'Strip of 10', icon: '💊',
      unitPricePaisa: 45000, quantity: 2, lineTotalPaisa: 90000, requiresPrescription: false,
    }],
    couponCode: null,
    subtotalPaisa: 90000, discountPaisa: 0, taxPaisa: 0, shippingPaisa: 9900, totalPaisa: 99900,
    requiresPrescription: false, hasLabItems: false,
    estimatedDeliveryFrom: 'Tue 22 Jul', estimatedDeliveryTo: 'Wed 23 Jul',
    idempotencyKey: 'key-' + Math.random().toString(36).slice(2),
    emailStatus: 'skipped',
    statusHistory: [],
    ...over,
  }
}

console.log('\nOrder storage and idempotency')
{
  const order = makeOrder({ idempotencyKey: 'fixed-key-123' })
  insertOrder(order)

  check('order retrievable by number', findOrderByNumber(order.orderNumber)?.id === order.id)
  check('order lookup is case-insensitive',
    findOrderByNumber(order.orderNumber.toLowerCase())?.id === order.id)
  check('unknown order number returns nothing', findOrderByNumber('HC-000000') === undefined)

  check('idempotency key resolves to the original order',
    findOrderByIdempotencyKey('fixed-key-123')?.id === order.id)
  check('unseen idempotency key resolves to nothing',
    findOrderByIdempotencyKey('never-used') === undefined)
}

console.log('\nTracking requires phone as a second factor')
{
  const order = makeOrder({ phone: '03009998877' })
  insertOrder(order)

  check('correct order number + phone resolves',
    findOrderForTracking(order.orderNumber, '03009998877')?.id === order.id)
  check('formatted phone still matches',
    findOrderForTracking(order.orderNumber, '+92 300 999 8877')?.id === order.id)
  check('order number alone with a wrong phone is refused',
    findOrderForTracking(order.orderNumber, '03001112222') === undefined)
}

console.log('\nConfirmation email')
{
  const order = makeOrder({ couponCode: 'SAVE10', discountPaisa: 9000, taxPaisa: 1530 })
  const text = orderConfirmationText(order)
  const html = orderConfirmationHtml(order)

  check('subject carries the order number',
    orderConfirmationSubject(order).includes(order.orderNumber))
  check('text version includes the order number', text.includes(order.orderNumber))
  check('text version includes the item name', text.includes('Panadol Extra 500mg'))
  check('text version includes the total', text.includes('Rs 999'))
  check('text version includes the discount line', text.includes('SAVE10'))
  check('text version includes the delivery address', text.includes('House 12, Block B'))
  check('html version includes the order number', html.includes(order.orderNumber))
  check('html version has a tracking link', html.includes('/track-order?order='))
  check('html is a complete document', html.startsWith('<!doctype html>') && html.includes('</html>'))

  const rx = orderConfirmationHtml(makeOrder({ requiresPrescription: true }))
  check('prescription notice appears only when relevant',
    rx.includes('Prescription required') && !html.includes('Prescription required'))

  const bank = orderConfirmationHtml(makeOrder({ paymentMethod: 'bank_transfer' }))
  check('bank details appear only for bank transfer',
    bank.includes('IBAN') && !html.includes('IBAN'))

  const nasty = orderConfirmationHtml(makeOrder({ firstName: '<script>alert(1)</script>' }))
  check('customer input is HTML-escaped',
    !nasty.includes('<script>alert(1)</script>') && nasty.includes('&lt;script&gt;'))
}

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
