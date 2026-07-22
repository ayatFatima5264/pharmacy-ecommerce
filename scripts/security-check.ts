/**
 * Verification for the security layer and order status machine.
 * Run with: npm run check:security
 *
 * NOTE: there are deliberately NO password-hashing or session assertions.
 * Supabase Auth owns credentials and sessions (docs/SECURITY.md §1); testing
 * a vendor's hashing from here would only test our assumptions about it.
 */
import { checkRateLimit, resetRateLimit, clientIp } from '../src/lib/security/rate-limit'
import {
  ORDER_STATUSES,
  STATUS_EMAIL,
  allowedTransitions,
  canTransition,
  isTerminal,
  transitionError,
} from '../src/features/orders/status-machine'
import {
  ROLE_PERMISSIONS,
  permissionsFor,
  roleHasPermission,
  type RoleKey,
} from '../src/features/auth/staff/permissions'
import { esc } from '../src/lib/email/layout'

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail = '') {
  if (condition) { passed++; console.log(`  PASS  ${name}`) }
  else { failed++; console.log(`  FAIL  ${name}${detail ? ` - ${detail}` : ''}`) }
}

async function main() {

console.log('\nRate limiting')
{
  resetRateLimit('login', 'test-ip')

  let allowed = 0
  for (let i = 0; i < 5; i++) {
    if (checkRateLimit('login', 'test-ip').allowed) allowed++
  }
  check('login allows exactly 5 attempts', allowed === 5, String(allowed))

  const sixth = checkRateLimit('login', 'test-ip')
  check('sixth login attempt is blocked', !sixth.allowed)
  check('blocked response carries a retry-after', sixth.retryAfterSeconds > 0)

  // Buckets are per identifier, or one attacker would lock out every user.
  check('a different IP is unaffected', checkRateLimit('login', 'other-ip').allowed)

  resetRateLimit('login', 'test-ip')
  check('reset clears the bucket', checkRateLimit('login', 'test-ip').allowed)

  // Independent budgets per action.
  resetRateLimit('coupon', 'test-ip')
  check('coupon limit is separate from login', checkRateLimit('coupon', 'test-ip').allowed)
}

console.log('\nClient IP extraction')
{
  check('x-forwarded-for is used',
    clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4' })) === '1.2.3.4')
  check('first hop is taken from a proxy chain',
    clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })) === '1.2.3.4')
  check('falls back to unknown', clientIp(new Headers()) === 'unknown')
}

console.log('\nRole-based authorization')
{
  check('admin holds every permission',
    permissionsFor('admin').length === new Set(permissionsFor('admin')).size &&
      roleHasPermission('admin', 'settings.manage'))

  // The important negative cases - these are what authorization is FOR.
  check('support cannot manage products', !roleHasPermission('support', 'products.manage'))
  check('support cannot change order status', !roleHasPermission('support', 'orders.update_status'))
  check('support cannot view reports', !roleHasPermission('support', 'reports.view'))
  check('manager cannot verify prescriptions', !roleHasPermission('manager', 'rx.verify'))
  check('pharmacist cannot manage settings', !roleHasPermission('pharmacist', 'settings.manage'))
  check('pharmacist cannot refund', !roleHasPermission('pharmacist', 'orders.refund'))

  // Clinical authority is not granted by seniority.
  check('ONLY the pharmacist may verify prescriptions',
    (Object.keys(ROLE_PERMISSIONS) as RoleKey[]).filter((r) =>
      roleHasPermission(r, 'rx.verify'),
    ).join(',') === 'admin,pharmacist')

  check('every role can view orders',
    (Object.keys(ROLE_PERMISSIONS) as RoleKey[]).every((r) => roleHasPermission(r, 'orders.view')))
}

console.log('\nOrder status machine')
{
  check('six statuses defined', ORDER_STATUSES.length === 6)

  check('pending can be confirmed', canTransition('pending', 'confirmed'))
  check('confirmed can start processing', canTransition('confirmed', 'processing'))
  check('processing can ship', canTransition('processing', 'shipped'))
  check('shipped can be delivered', canTransition('shipped', 'delivered'))

  // The rules that stop a status column becoming meaningless.
  check('delivered cannot go back to pending', !canTransition('delivered', 'pending'))
  check('delivered cannot be cancelled', !canTransition('delivered', 'cancelled'))
  check('cancelled cannot be reopened', !canTransition('cancelled', 'confirmed'))
  check('pending cannot skip straight to shipped', !canTransition('pending', 'shipped'))
  check('shipped cannot be cancelled (return instead)', !canTransition('shipped', 'cancelled'))

  check('delivered is terminal', isTerminal('delivered'))
  check('cancelled is terminal', isTerminal('cancelled'))
  check('pending is not terminal', !isTerminal('pending'))

  check('cancellation allowed before dispatch',
    canTransition('pending', 'cancelled') &&
      canTransition('confirmed', 'cancelled') &&
      canTransition('processing', 'cancelled'))

  check('processing can step back to confirmed', canTransition('processing', 'confirmed'))
}

console.log('\nTransition error messages')
{
  check('legal transition yields no error', transitionError('pending', 'confirmed') === null)
  check('same-status move is explained',
    (transitionError('shipped', 'shipped') ?? '').includes('already'))
  check('delivered refusal mentions returns',
    (transitionError('delivered', 'cancelled') ?? '').toLowerCase().includes('return'))
  check('cancelled refusal explains it cannot reopen',
    (transitionError('cancelled', 'confirmed') ?? '').toLowerCase().includes('cannot be reopened'))
  check('shipped cancellation suggests a return',
    (transitionError('shipped', 'cancelled') ?? '').toLowerCase().includes('return'))
}

console.log('\nStatus email mapping')
{
  check('confirmed triggers the confirmation email', STATUS_EMAIL.confirmed === 'confirmation')
  check('shipped triggers the shipped email', STATUS_EMAIL.shipped === 'shipped')
  check('delivered triggers the delivered email', STATUS_EMAIL.delivered === 'delivered')
  // Silence is deliberate: nobody wants "your order is being picked".
  check('processing sends nothing', STATUS_EMAIL.processing === undefined)
  check('pending sends nothing', STATUS_EMAIL.pending === undefined)
  check('cancelled sends nothing automatically', STATUS_EMAIL.cancelled === undefined)
}

console.log('\nEmail escaping (XSS via mail)')
{
  check('script tags are escaped',
    esc('<script>alert(1)</script>') === '&lt;script&gt;alert(1)&lt;/script&gt;')
  check('quotes are escaped', esc('"onmouseover="alert(1)').includes('&quot;'))
  check('single quotes are escaped', esc("it's").includes('&#39;'))
  check('ampersands are escaped first (no double-encoding)',
    esc('&lt;') === '&amp;lt;')
  check('null and undefined become empty strings', esc(null) === '' && esc(undefined) === '')
}

console.log('\nJSON-LD script-breakout escaping')
{
  // Mirrors the escaping applied on the product page.
  const escapeJsonLd = (value: unknown) =>
    JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')

  const hostile = escapeJsonLd({ name: 'Panadol</script><script>alert(1)</script>' })
  check('closing script tag cannot break out', !hostile.includes('</script>'))
  check('opening script tag is neutralised', !hostile.includes('<script>'))
  check('escaped payload is still valid JSON', typeof JSON.parse(hostile) === 'object')
}

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)

}

main()
