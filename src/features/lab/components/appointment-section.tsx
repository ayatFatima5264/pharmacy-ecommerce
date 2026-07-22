'use client'

import * as React from 'react'
import { AlertCircle, Home, Loader2, MapPin, Utensils } from 'lucide-react'
import { Field, Input, Select } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { GENDER_OPTIONS } from '@/features/lab/schemas/booking-schema'
import { getAvailability, type SlotAvailability } from '@/features/lab/actions/slot-actions'
import { cn } from '@/lib/utils'

/**
 * The lab appointment step of checkout.
 *
 * Availability is fetched per city and refetched when the city changes, because
 * phlebotomist capacity is per city — a slot that is open in Karachi may be full
 * in Quetta, where two people cover the whole city.
 */
export function AppointmentSection({
  city,
  fastingHours,
  testNames,
  errors,
}: {
  city: string
  fastingHours: number | null
  testNames: string[]
  errors: (key: string) => string | undefined
}) {
  const [availability, setAvailability] = React.useState<SlotAvailability | null>(null)
  const [selectedDate, setSelectedDate] = React.useState<string>('')
  const [selectedSlot, setSelectedSlot] = React.useState<string>('')
  const [collectionMode, setCollectionMode] = React.useState<'home' | 'lab_visit'>('home')
  const [loading, startTransition] = React.useTransition()

  // Refetch whenever the city changes — capacity is per city.
  React.useEffect(() => {
    startTransition(async () => {
      const result = await getAvailability(city)
      setAvailability(result)
      const firstDate = result.dates[0]?.date ?? ''
      setSelectedDate(firstDate)
      const firstOpen = result.slots.find((s) => !s.isFull && !s.isPast)
      setSelectedSlot(firstOpen?.id ?? '')
      if (!result.homeCollectionAvailable) setCollectionMode('lab_visit')
    })
  }, [city])

  function pickDate(date: string) {
    setSelectedDate(date)
    startTransition(async () => {
      const result = await getAvailability(city, date)
      setAvailability(result)
      const firstOpen = result.slots.find((s) => !s.isFull && !s.isPast)
      setSelectedSlot(firstOpen?.id ?? '')
    })
  }

  const slots = availability?.slots ?? []
  const homeAvailable = availability?.homeCollectionAvailable ?? false

  return (
    <div className="flex flex-col gap-6">
      {/* What is being booked, and what it demands of the patient. */}
      <div className="rounded-sm bg-gray-50 p-4">
        <p className="text-body-sm font-semibold text-gray-900">
          {testNames.length} {testNames.length === 1 ? 'test' : 'tests'} in this appointment
        </p>
        <p className="mt-1 text-body-sm text-gray-500">{testNames.join(' · ')}</p>

        {fastingHours !== null && (
          <p className="mt-3 flex items-start gap-2 rounded-sm bg-amber-50 p-3 text-body-sm text-amber-700">
            <Utensils className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <strong className="font-semibold">{fastingHours} hours fasting required.</strong>{' '}
              Nothing but water beforehand. A morning slot is easiest — most of the fast happens
              while you sleep.
            </span>
          </p>
        )}
      </div>

      {/* Patient details — may not be the person ordering. */}
      <fieldset>
        <legend className="mb-1 text-body-sm font-semibold text-gray-700">Patient details</legend>
        <p className="mb-3 text-body-sm text-gray-500">
          Whose test is this? Age and sex are required — reference ranges on the report depend on
          both.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Patient's full name"
            htmlFor="patientName"
            error={errors('patientName')}
            required
            className="sm:col-span-2"
          >
            <Input
              id="patientName"
              name="patientName"
              autoComplete="off"
              aria-invalid={!!errors('patientName')}
              required
            />
          </Field>

          <Field label="Age" htmlFor="patientAge" error={errors('patientAge')} required>
            <Input
              id="patientAge"
              name="patientAge"
              inputMode="numeric"
              maxLength={3}
              placeholder="34"
              className="tabular"
              aria-invalid={!!errors('patientAge')}
              required
            />
          </Field>

          <Field label="Sex" htmlFor="patientGender" error={errors('patientGender')} required>
            <Select id="patientGender" name="patientGender" defaultValue="" required>
              <option value="" disabled>
                Choose…
              </option>
              {GENDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Patient's mobile"
            htmlFor="patientPhone"
            error={errors('patientPhone')}
            hint="The phlebotomist calls this number before arriving"
            required
            className="sm:col-span-2"
          >
            <Input
              id="patientPhone"
              name="patientPhone"
              type="tel"
              inputMode="tel"
              placeholder="03001234567"
              aria-invalid={!!errors('patientPhone')}
              required
            />
          </Field>
        </div>
      </fieldset>

      {/* Collection mode */}
      <fieldset>
        <legend className="mb-2.5 text-body-sm font-semibold text-gray-700">
          How would you like the sample collected?
        </legend>
        <div className="flex flex-col gap-2.5">
          <label
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-3.5 rounded-sm border p-4',
              collectionMode === 'home' ? 'border-blue-600 bg-blue-50' : 'border-gray-200',
              !homeAvailable && 'cursor-not-allowed opacity-60',
            )}
          >
            <input
              type="radio"
              name="collectionMode"
              value="home"
              checked={collectionMode === 'home'}
              onChange={() => setCollectionMode('home')}
              disabled={!homeAvailable}
              className="h-[18px] w-[18px] shrink-0 cursor-pointer border-gray-200 text-blue-600 focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            />
            <Home className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-body-sm font-semibold text-gray-900">Home collection</span>
              <span className="block text-body-sm text-gray-500">
                {homeAvailable
                  ? 'A phlebotomist visits your delivery address'
                  : `Not available in ${city} yet`}
              </span>
            </span>
          </label>

          <label
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-3.5 rounded-sm border p-4',
              collectionMode === 'lab_visit' ? 'border-blue-600 bg-blue-50' : 'border-gray-200',
            )}
          >
            <input
              type="radio"
              name="collectionMode"
              value="lab_visit"
              checked={collectionMode === 'lab_visit'}
              onChange={() => setCollectionMode('lab_visit')}
              className="h-[18px] w-[18px] shrink-0 cursor-pointer border-gray-200 text-blue-600 focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            />
            <MapPin className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-body-sm font-semibold text-gray-900">Visit the lab</span>
              <span className="block text-body-sm text-gray-500">
                Walk in during your chosen slot — no collection fee
              </span>
            </span>
          </label>
        </div>
        {errors('collectionMode') && (
          <p className="mt-2 text-body-sm text-red-600">{errors('collectionMode')}</p>
        )}
      </fieldset>

      {/* Date */}
      <fieldset>
        <legend className="mb-2.5 text-body-sm font-semibold text-gray-700">Collection date</legend>

        {loading && !availability ? (
          <div className="flex items-center gap-2 text-body-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Checking availability in {city}…
          </div>
        ) : availability?.dates.length === 0 ? (
          <p className="flex items-start gap-2 rounded-sm bg-red-50 p-3 text-body-sm text-red-600">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            No collection slots are available in {city} at the moment. Please call us and we will
            arrange one.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {availability?.dates.map((date) => (
              <button
                key={date.date}
                type="button"
                onClick={() => pickDate(date.date)}
                aria-pressed={selectedDate === date.date}
                className={cn(
                  'flex min-h-11 flex-col items-center rounded-sm border px-4 py-2 text-body-sm font-semibold',
                  selectedDate === date.date
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-700 hover:border-gray-400',
                )}
              >
                <span className="text-[11.5px] font-medium uppercase tracking-[0.04em] text-gray-500">
                  {date.weekday}
                </span>
                {date.label}
              </button>
            ))}
          </div>
        )}
        <input type="hidden" name="slotDate" value={selectedDate} />
        {errors('slotDate') && <p className="mt-2 text-body-sm text-red-600">{errors('slotDate')}</p>}
      </fieldset>

      {/* Time slot */}
      {slots.length > 0 && (
        <fieldset>
          <legend className="mb-2.5 text-body-sm font-semibold text-gray-700">Time slot</legend>
          <div className="flex flex-wrap gap-2.5">
            {slots.map((slot) => {
              const disabled = slot.isFull || slot.isPast
              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSelectedSlot(slot.id)}
                  aria-pressed={selectedSlot === slot.id}
                  className={cn(
                    'flex min-h-11 items-center gap-2 rounded-sm border px-4 py-2 text-body-sm font-semibold',
                    disabled
                      ? 'cursor-not-allowed border-gray-200 text-gray-400'
                      : selectedSlot === slot.id
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-700 hover:border-gray-400',
                  )}
                >
                  {slot.label}
                  {/* Full and past slots stay visible but disabled — hiding them
                      makes availability unreadable. */}
                  {slot.isPast ? (
                    <span className="font-normal text-gray-400">· Passed</span>
                  ) : slot.isFull ? (
                    <span className="font-normal text-gray-400">· Full</span>
                  ) : slot.remaining <= 2 ? (
                    <span className="font-normal text-amber-700">· {slot.remaining} left</span>
                  ) : null}
                  {fastingHours !== null && slot.suitableForFasting && !disabled && (
                    <Badge tone="success">Best for fasting</Badge>
                  )}
                </button>
              )
            })}
          </div>
          <input type="hidden" name="slotId" value={selectedSlot} />
          {errors('slotId') && <p className="mt-2 text-body-sm text-red-600">{errors('slotId')}</p>}
        </fieldset>
      )}
    </div>
  )
}
