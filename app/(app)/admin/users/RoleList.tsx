'use client'

import { useActionState } from 'react'
import { Label, Select } from '@/components/ui'
import { SubmitButton } from '@/components/SubmitButton'
import { setRole } from '@/app/actions/admin'
import { ROLES, ROLE_LABELS, type Account } from '@/lib/roles'

/**
 * One role selector per account.
 *
 * The role column is editable rather than a separate "edit role" form so an admin
 * can see the whole roster and its permissions at once. `isSelf` rows render a
 * static badge instead: the action refuses to change your own role, and a
 * control that always fails is worse than one that explains why it is fixed.
 */
export function RoleList({ accounts }: { accounts: Account[] }) {
  const [state, formAction] = useActionState(setRole, {})

  return (
    <div className="space-y-4">
      {state.error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {state.error}
        </p>
      )}

      {state.message && (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {state.message}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th
                scope="col"
                className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
              >
                Username
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
              >
                Role
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
              >
                <span className="sr-only">Change role</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr
                key={account.id}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
              >
                <td className="px-4 py-2.5 align-middle">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {account.username}
                  </span>
                  {account.isSelf && (
                    <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">you</span>
                  )}
                  {!account.confirmed && (
                    <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                      unconfirmed
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 align-middle text-zinc-700 dark:text-zinc-300">
                  {account.role ? ROLE_LABELS[account.role] : 'No role'}
                  {account.role === null && (
                    <span className="block text-xs text-zinc-400 dark:text-zinc-500">
                      Sees nothing until a role is set.
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 align-middle">
                  {account.isSelf ? (
                    <p className="text-right text-xs text-zinc-400 dark:text-zinc-500">
                      Your own role is fixed here
                    </p>
                  ) : (
                    <form action={formAction} className="flex items-end justify-end gap-2">
                      <input type="hidden" name="username" value={account.username} />
                      <div className="w-36">
                        <Label htmlFor={`role-${account.id}`} className="sr-only">
                          Role for {account.username}
                        </Label>
                        <Select
                          id={`role-${account.id}`}
                          name="role"
                          defaultValue={account.role ?? ''}
                        >
                          <option value="" disabled>
                            No role
                          </option>
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <SubmitButton size="sm" variant="primary">
                        Save
                      </SubmitButton>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        The role is stored in the account&apos;s server-side metadata, which is what the row-level
        security policies read. It is issued into the session at sign-in, so the change only takes
        effect once that person signs in again.
      </p>
    </div>
  )
}