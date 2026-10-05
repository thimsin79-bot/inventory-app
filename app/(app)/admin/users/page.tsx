import { Card } from '@/components/ui'
import { requireAdmin } from '@/lib/supabase/dal'
import { ROLES, ROLE_LABELS } from '@/lib/roles'
import { listAccounts } from '@/app/actions/admin'
import { ResetPasswordForm } from './ResetPasswordForm'
import { RoleList } from './RoleList'

/**
 * Account administration.
 *
 * Sits inside the (app) group, so it already inherits requireUser() from the
 * proxy and the layout shell. requireAdmin() adds the role check on top, because
 * "signed in" is not the same as "may reset anyone's password" or "may change
 * anyone's role".
 */
export default async function AdminUsersPage() {
  await requireAdmin()

  const result = await listAccounts()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          User accounts
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Accounts here have no email inbox, so a forgotten password can only be
          replaced by hand. You will know the password you set.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Roles
        </h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((role) => (
            <div key={role} className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <dt className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {ROLE_LABELS[role]}
              </dt>
              <dd className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {role === 'admin'
                  ? 'Everything, plus accounts and roles.'
                  : role === 'manager'
                    ? 'Everything except accounts and roles.'
                    : role === 'staff'
                      ? 'Record movements, requests, audits and purchases.'
                      : 'Read everything, change nothing.'}
              </dd>
            </div>
          ))}
        </dl>

        <Card className="p-6">
          {result.ok ? (
            <RoleList accounts={result.accounts} />
          ) : (
            <p className="text-sm text-red-700 dark:text-red-300">{result.error}</p>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Reset a password
        </h2>
        <Card className="w-full max-w-md p-6">
          <ResetPasswordForm />
        </Card>
      </section>
    </div>
  )
}