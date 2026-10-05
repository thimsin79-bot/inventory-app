import { Card } from '@/components/ui'
import { requireAdmin } from '@/lib/supabase/dal'
import { ResetPasswordForm } from './ResetPasswordForm'

/**
 * Account administration.
 *
 * Sits inside the (app) group, so it already inherits requireUser() from the
 * proxy and the layout shell. requireAdmin() adds the role check on top, because
 * "signed in" is not the same as "may reset anyone's password".
 */
export default async function AdminUsersPage() {
  await requireAdmin()

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

      <Card className="w-full max-w-md p-6">
        <ResetPasswordForm />
      </Card>
    </div>
  )
}