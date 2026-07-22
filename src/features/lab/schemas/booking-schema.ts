import { z } from 'zod'

/**
 * Lab appointment validation.
 *
 * Patient details are captured separately from the person ordering, because
 * people routinely book tests for parents and children. Age and sex are not
 * decoration — reference ranges for most analytes differ by both, so a report
 * cannot be interpreted without them.
 */
export const labBookingSchema = z.object({
  patientName: z
    .string()
    .trim()
    .min(3, "Enter the patient's full name")
    .max(80, 'That name is too long'),

  patientAge: z
    .string()
    .trim()
    .min(1, "Enter the patient's age")
    .refine((v) => /^\d{1,3}$/.test(v), 'Age must be a whole number')
    .transform((v) => Number.parseInt(v, 10))
    .refine((v) => v >= 0 && v <= 120, 'Enter an age between 0 and 120'),

  patientGender: z.enum(['male', 'female', 'other'], {
    errorMap: () => ({ message: "Choose the patient's sex" }),
  }),

  patientPhone: z
    .string()
    .trim()
    .regex(/^(?:\+92|0)3\d{9}$/, 'Enter a valid mobile number, e.g. 03001234567'),

  collectionMode: z.enum(['home', 'lab_visit'], {
    errorMap: () => ({ message: 'Choose home collection or a lab visit' }),
  }),

  slotDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a collection date'),

  slotId: z.string().trim().min(1, 'Choose a time slot'),
})

export type LabBookingValues = z.infer<typeof labBookingSchema>
export type LabBookingInput = z.input<typeof labBookingSchema>

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
] as const
