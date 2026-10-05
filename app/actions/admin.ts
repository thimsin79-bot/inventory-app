'use server'

import { requireAdmin } from '@/lib/supabase/dal'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  normalizeUsername,
  passwordProblem,
  usernameProblem,
  usernameToEmail,
  type AuthState,
} from '@/lib/auth'

const PER_PAGE = 1000
const MAX_PAGES = 20

type AdminAuth = ReturnType<typeof createAdminClient>

/**
 * Finds an auth user by address.
 *
 * The admin API has no lookup-by-email call, so this pages through the user list.
 * Accounts here are `username@users.invalid`, which makes the address derivable
 * from the username alone and avoids listing every account on screen.
 */
async function findUserByEmail(
  admin: AdminAuth,
  email: string,
): Promise<{ id: string } | null> {
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    })

    if (error) throw new Error(error.message)

    const match = data.users.find((user) => user.email?.toLowerCase() === email)
    if (match) return { id: match.id }
    if (data.users.length < PER_PAGE) return null
  }

  return null
}

/**
 * Sets a new password for an account, by hand.
 *
 * These accounts have no mailbox, so there is no self-service reset link to send.
 * An admin sets the password and passes it on over a channel they trust. That
 * means the admin learns the password, which is the accepted trade for not
 * requiring any email infrastructure at all.
 */
export async function resetPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  // Authorise BEFORE the service role client is constructed. That client bypasses
  // RLS entirely, so this check is the only thing between a signed-in user and the
  // ability to take over any account. Validate input afterwards: telling an
  // anonymous caller which usernames exist is its own leak.
  await requireAdmin()

  const username = normalizeUsername(String(formData.get('username') ?? ''))
  const password = String(formData.get('password') ?? '')
  const confirmPassword = String(formData.get('confirmPassword') ?? '')

  const badUsername = usernameProblem(username)
  if (badUsername) return { error: `That username must ${badUsername}.`, username }

  const weak = passwordProblem(password)
  if (weak) return { error: `The new password must ${weak}.`, username }

  if (password !== confirmPassword) {
    return { error: 'The two passwords do not match.', username }
  }

  try {
    const admin = createAdminClient()
    const target = await findUserByEmail(admin, usernameToEmail(username))

    if (!target) {
      return { error: `No account found for "${username}".`, username }
    }

    const { error } = await admin.auth.admin.updateUserById(target.id, {
      password,
      // Also clears the unconfirmed state, so an account created while email
      // confirmation was enabled becomes usable.
      email_confirm: true,
    })

    if (error) {
      console.error('[admin] password reset failed:', error.message)
      return { error: 'The reset did not go through. Check the server logs.', username }
    }

    return {
      message: `Password reset for "${username}". Pass it on over a channel you both trust — the password is now known to you as well as them.`,
      username,
    }
  } catch (error) {
    // Almost always a deployment without SUPABASE_SERVICE_ROLE_KEY. Details stay
    // in the logs so nothing that could carry key material is echoed to a browser.
    console.error('[admin] reset unavailable:', error)
    return {
      error:
        'Password reset is unavailable on this deployment. It needs SUPABASE_SERVICE_ROLE_KEY set, then rebuilt.',
      username,
    }
  }
}