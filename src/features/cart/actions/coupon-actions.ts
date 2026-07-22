'use server'

import { adminCoupons, ADMIN_NOW } from '@/lib/data/admin'
import { useDb } from '@/lib/data/source'
import { lookupCouponDb } from '@/lib/data/db/lab-admin-db'
import type { CouponRule } from '../types'

/**
 * Coupon validation runs on the SERVER, deliberately.
 *
 * Validating client-side would mean shipping the coupon table in the JS bundle,
 * where anyone can read every unreleased code out of it. The action returns only
 * the rule for the one code the customer already typed.
 *
 * The returned rule is cached client-side so the discount recomputes instantly
 * as the cart changes — but it is re-validated server-side at checkout, because
 * a client-held rule is a convenience, never an authority.
 */

export type CouponResult =
  | { ok: true; rule: CouponRule; message: string }
  | { ok: false; message: string }

export async function validateCoupon(
  code: string,
  subtotalPaisa: number,
): Promise<CouponResult> {
  const normalized = code.trim().toUpperCase()

  if (!normalized) {
    return { ok: false, message: 'Enter a coupon code.' }
  }

  // Database path: the coupons table is the authority, and redemption at
  // checkout is ledgered by place_order against the same row.
  if (useDb()) {
    const result = await lookupCouponDb(normalized, subtotalPaisa)
    if (!result.ok) {
      switch (result.reason) {
        case 'not_started':
          return { ok: false, message: 'This code is not active yet.' }
        case 'expired':
          return { ok: false, message: 'This code has expired.' }
        case 'exhausted':
          return { ok: false, message: 'This code has reached its usage limit.' }
        case 'min_order': {
          const shortfall = ((result.minOrderPaisa ?? 0) - subtotalPaisa) / 100
          return {
            ok: false,
            message: `Add Rs ${shortfall.toLocaleString('en-PK')} more to use this code.`,
          }
        }
        default:
          // Unknown and disabled share one message — no probing oracle.
          return { ok: false, message: `"${normalized}" is not a valid code.` }
      }
    }
    const description =
      result.rule.discountType === 'percentage'
        ? `${result.rule.discountValue}% off`
        : result.rule.discountType === 'fixed_amount'
          ? `Rs ${result.rule.discountValue} off`
          : 'free delivery'
    return { ok: true, rule: result.rule, message: `${result.rule.code} applied — ${description}.` }
  }

  const coupon = adminCoupons.find((c) => c.code.toUpperCase() === normalized)

  // Same message whether the code is unknown or disabled — distinguishing them
  // turns the form into an oracle for probing which codes exist.
  if (!coupon || !coupon.isActive) {
    return { ok: false, message: `"${normalized}" is not a valid code.` }
  }

  const now = ADMIN_NOW

  if (new Date(coupon.startsAt).getTime() > now) {
    return { ok: false, message: 'This code is not active yet.' }
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now) {
    return { ok: false, message: 'This code has expired.' }
  }
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    return { ok: false, message: 'This code has reached its usage limit.' }
  }
  if (subtotalPaisa < coupon.minOrderPaisa) {
    const shortfall = (coupon.minOrderPaisa - subtotalPaisa) / 100
    return {
      ok: false,
      message: `Add Rs ${shortfall.toLocaleString('en-PK')} more to use this code.`,
    }
  }

  const rule: CouponRule = {
    code: coupon.code.toUpperCase(),
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    minOrderPaisa: coupon.minOrderPaisa,
    maxDiscountPaisa: coupon.maxDiscountPaisa,
  }

  const description =
    coupon.discountType === 'percentage'
      ? `${coupon.discountValue}% off`
      : coupon.discountType === 'fixed_amount'
        ? `Rs ${coupon.discountValue} off`
        : 'free delivery'

  return { ok: true, rule, message: `${rule.code} applied — ${description}.` }
}
