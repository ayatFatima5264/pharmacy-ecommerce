import { z } from 'zod'

/**
 * Customer auth input validation. Password POLICY (strength, breach checks,
 * history) belongs to Supabase Auth configuration; these schemas only reject
 * what is unambiguously malformed before it costs a network call.
 */

const email = z.string().trim().email('Enter a valid email address').max(120)

export const customerLoginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password').max(200),
})

export const customerRegisterSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your name').max(120),
  email,
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .max(200, 'Password is too long'),
})

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters').max(200),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  })
