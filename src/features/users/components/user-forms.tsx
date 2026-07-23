'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { KeyRound, Power, Trash2 } from 'lucide-react'
import {
  AdminCheckbox,
  AdminField,
  AdminInput,
  AdminSelect,
  FormBanner,
  SubmitButton,
  fieldError,
} from '@/components/admin/form-kit'
import {
  createStaffUser,
  deleteStaffUser,
  resetStaffPassword,
  toggleStaffActive,
  updateStaffUser,
} from '@/features/users/actions'
import { ROLE_LABELS, type RoleKey } from '@/features/auth/staff/permissions'
import { idleState, type ActionState } from '@/features/catalog/actions/action-result'
import type { StaffUser } from '@/features/users/queries'

/**
 * Role choices, simplest first: Administrator (everything) and Staff
 * (monitoring only). The two specialist roles stay assignable because the
 * pharmacy runs on them — a pharmacist licence gates prescription approval.
 */
const ROLE_OPTIONS: { value: RoleKey; label: string; hint: string }[] = [
  { value: 'admin', label: ROLE_LABELS.admin, hint: 'Full access, including user management' },
  { value: 'support', label: ROLE_LABELS.support, hint: 'View-only: dashboard, orders, customers, products, reports' },
  { value: 'manager', label: ROLE_LABELS.manager, hint: 'Catalog, orders, inventory — no user or settings access' },
  { value: 'pharmacist', label: ROLE_LABELS.pharmacist, hint: 'Prescription verification (requires licence record)' },
]

function RoleSelect({ name, defaultValue }: { name: string; defaultValue: RoleKey }) {
  const [role, setRole] = React.useState<RoleKey>(defaultValue)
  const active = ROLE_OPTIONS.find((option) => option.value === role)
  return (
    <>
      <AdminSelect
        id={name}
        name={name}
        value={role}
        onChange={(e) => setRole(e.target.value as RoleKey)}
      >
        {ROLE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </AdminSelect>
      {active && <p className="mt-1 text-[12px] text-gray-500">{active.hint}</p>}
    </>
  )
}

export function CreateUserForm() {
  const [state, formAction] = useActionState(createStaffUser, idleState)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormBanner state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField label="Full name" name="fullName" required error={fieldError(state, 'fullName')}>
          <AdminInput id="fullName" name="fullName" required autoComplete="off" />
        </AdminField>
        <AdminField label="Email" name="email" required error={fieldError(state, 'email')}>
          <AdminInput id="email" name="email" type="email" required autoComplete="off" />
        </AdminField>
        <AdminField label="Phone" name="phone" hint="Optional" error={fieldError(state, 'phone')}>
          <AdminInput id="phone" name="phone" type="tel" />
        </AdminField>
        <AdminField label="Role" name="role" required>
          <RoleSelect name="role" defaultValue="support" />
        </AdminField>
        <AdminField
          label="Password"
          name="password"
          required
          hint="At least 10 characters — share it securely."
          error={fieldError(state, 'password')}
        >
          <AdminInput id="password" name="password" type="password" required autoComplete="new-password" />
        </AdminField>
        <AdminField
          label="Confirm password"
          name="confirmPassword"
          required
          error={fieldError(state, 'confirmPassword')}
        >
          <AdminInput id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" />
        </AdminField>
      </div>

      <AdminCheckbox
        name="active"
        label="Active"
        description="Inactive accounts cannot sign in to the console."
        defaultChecked
      />

      <div className="flex justify-end border-t border-gray-100 pt-4">
        <SubmitButton pendingLabel="Creating…">Create user</SubmitButton>
      </div>
    </form>
  )
}

export function EditUserForm({ user }: { user: StaffUser }) {
  const boundUpdate = updateStaffUser.bind(null, user.id)
  const [state, formAction] = useActionState(boundUpdate, idleState)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormBanner state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField label="Full name" name="fullName" required error={fieldError(state, 'fullName')}>
          <AdminInput id="fullName" name="fullName" defaultValue={user.name} required />
        </AdminField>
        <AdminField label="Email" name="email" required error={fieldError(state, 'email')}>
          <AdminInput id="email" name="email" type="email" defaultValue={user.email} required />
        </AdminField>
        <AdminField label="Phone" name="phone" hint="Optional" error={fieldError(state, 'phone')}>
          <AdminInput id="phone" name="phone" type="tel" defaultValue={user.phone ?? ''} />
        </AdminField>
        <AdminField label="Role" name="role" required>
          <RoleSelect name="role" defaultValue={user.primaryRole} />
        </AdminField>
        <AdminField
          label="New password"
          name="password"
          hint="Leave blank to keep the current password."
          error={fieldError(state, 'password')}
        >
          <AdminInput id="password" name="password" type="password" autoComplete="new-password" />
        </AdminField>
      </div>

      <AdminCheckbox
        name="active"
        label="Active"
        description="Inactive accounts cannot sign in to the console."
        defaultChecked={user.isActive}
      />

      <div className="flex justify-end border-t border-gray-100 pt-4">
        <SubmitButton pendingLabel="Saving…">Save account</SubmitButton>
      </div>
    </form>
  )
}

/* ----------------------- Danger-zone quick actions ----------------------- */

function QuickAction({
  action,
  userId,
  icon: Icon,
  label,
  pendingLabel,
  confirmMessage,
  tone = 'neutral',
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  userId: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  pendingLabel: string
  confirmMessage?: string
  tone?: 'neutral' | 'danger'
}) {
  const [state, formAction] = useActionState(action, idleState)

  return (
    <div className="flex flex-col gap-2">
      <form
        action={formAction}
        onSubmit={(event) => {
          if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault()
        }}
      >
        <input type="hidden" name="userId" value={userId} />
        <SubmitButton
          variant={tone === 'danger' ? 'danger' : 'outline'}
          pendingLabel={pendingLabel}
          className="w-full sm:w-auto"
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </SubmitButton>
      </form>
      {state.status !== 'idle' && (
        <p
          role={state.status === 'error' ? 'alert' : 'status'}
          className={`rounded-md p-2.5 text-[13px] ${
            state.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          }`}
        >
          {state.message}
        </p>
      )}
    </div>
  )
}

export function UserDangerZone({ user }: { user: StaffUser }) {
  return (
    <div className="flex flex-col gap-4">
      <QuickAction
        action={resetStaffPassword}
        userId={user.id}
        icon={KeyRound}
        label="Reset password"
        pendingLabel="Resetting…"
        confirmMessage={`Generate a new temporary password for ${user.name}? Their current password stops working immediately.`}
      />
      <QuickAction
        action={toggleStaffActive}
        userId={user.id}
        icon={Power}
        label={user.isActive ? 'Deactivate account' : 'Reactivate account'}
        pendingLabel="Applying…"
        confirmMessage={
          user.isActive ? `Deactivate ${user.name}? They will be signed out of the console.` : undefined
        }
      />
      <QuickAction
        action={deleteStaffUser}
        userId={user.id}
        icon={Trash2}
        label="Delete account"
        pendingLabel="Deleting…"
        tone="danger"
        confirmMessage={`Permanently delete ${user.name} (${user.email})? This cannot be undone.`}
      />
    </div>
  )
}
