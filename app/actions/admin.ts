'use server'

import { requireAdmin } from '@/lib/supabase/dal'
import { createAdminClient } from '@/lib/supabase/admin'
import type { User } from '@supabase/supabase-js'
import { emailToUsername, normalizeUsername, passwordProblem, usernameProblem, usernameToEmail, type AuthState } from '@/lib/auth'
import {
  ROLE_LABELS,
  describeAccount,
  isRole,
  isSelfAccount,
  mergeRoleInto,
  type Account,
} from '@/lib/roles'

const PER_PAGE = 1000
const MAX_PAGES = 20

type AdminAuth = ReturnType<typeof createAdminClient>

/**
 * Pages the whole user list.
 *
 * The admin API has no lookup-by-email call and caps a page at 1000 rows, so
 * anything that needs to see more than one account has to page. Both the reset
 * and the role list go through here so the paging cap lives in one place.
 */
async function listAllUsers(admin: AdminAuth): Promise<User[]> {
  const found: User[] = []

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    })

    if (error) throw new Error(error.message)

    found.push(...data.users)
    if (data.users.length < PER_PAGE) break
  }

  return found
}

/**
 * Finds an auth user by address.
 *
 * Accounts here are `username@users.invalid`, which makes the address derivable
 * from the username alone and avoids listing every account on screen.
 */
async function findUserByEmail(
  admin: AdminAuth,
  email: string,
): Promise<{ id: string; app_metadata?: Record<string, unknown> } | null> {
  const users = await listAllUsers(admin)

  return users.find((user) => user.email?.toLowerCase() === email) ?? null
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

export type AccountList =
  | { ok: true; accounts: Account[] }
  | { ok: false; error: string }

/**
 * Every account, with the role it currently holds.
 *
 * Authorised before the service-role client is constructed, for the same reason
 * as `resetPassword`: that client bypasses RLS, so this is an admin-only view of
 * the account table. The username is derived from the synthetic address rather
 * than sending the address itself to the browser.
 */
export async function listAccounts(): Promise<AccountList> {
  const adminUser = await requireAdmin()

  try {
    const admin = createAdminClient()
    const users = await listAllUsers(admin)

    return {
      ok: true,
      accounts: users.map((user) =>
        describeAccount(user, adminUser.id, emailToUsername(user.email)),
      ),
    }
  } catch (error) {
    console.error('[admin] account list unavailable:', error)
    return {
      ok: false,
      error:
        'The account list needs SUPABASE_SERVICE_ROLE_KEY set on this deployment, then rebuilt.',
    }
  }
}

/**
 * Sets an account's role.
 *
 * The role is written to `app_metadata`, which is the only place RLS reads it
 * from. `user_metadata` is deliberately left alone: the account holder can write
 * that field themselves through `supabase.auth.updateUser`, so a role stored
 * there would be self-assignable.
 */
export async function setRole(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = normalizeUsername(String(formData.get('username') ?? ''))
  const requested = String(formData.get('role') ?? '')

  // Authorise first. Same ordering as resetPassword: authorising before the
  // service-role client exists means an unauthorised caller cannot use this form
  // to enumerate accounts.
  const adminUser = await requireAdmin()

  const badUsername = usernameProblem(username)
  if (badUsername) return { error: `That username must ${badUsername}.`, username }

  if (!isRole(requested)) {
    return { error: 'Choose one of the listed roles.', username }
  }

  try {
    const admin = createAdminClient()
    const target = await findUserByEmail(admin, usernameToEmail(username))

    if (!target) {
      return { error: `No account found for "${username}".`, username }
    }

    // Refuse to change your own role. Demoting the last admin is unrecoverable
    // through the app -- /admin/users is the only surface that writes this field,
    // and it is the page the demotion would lock you out of. Another admin can
    // still change it, and a Service Role key or the dashboard always can.
    if (isSelfAccount(target.id, adminUser.id)) {
      return {
        error:
          'You cannot change your own role. Ask another admin to do it, or use the dashboard.',
        username,
      }
    }

    const { error } = await admin.auth.admin.updateUserById(target.id, {
      app_metadata: mergeRoleInto(target.app_metadata, requested),
    })

    if (error) {
      console.error('[admin] role update failed:', error.message)
      return { error: 'The role change did not go through. Check the server logs.', username }
    }

    return {
      message: `Role for "${username}" set to ${ROLE_LABELS[requested]}. It takes effect the next time they sign in.`,
      username,
    }
  } catch (error) {
    console.error('[admin] role update unavailable:', error)
    return {
      error:
        'Role changes are unavailable on this deployment. They need SUPABASE_SERVICE_ROLE_KEY set, then rebuilt.',
      username,
    }
  }
}