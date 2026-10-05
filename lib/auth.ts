export type AuthState = {
  error?: string
  message?: string
  username?: string
}

/**
 * Accounts are identified by username, not by email address.
 *
 * Supabase Auth's password grant only accepts an email or a phone number, so a
 * username is mapped to an address inside the RFC 2606 `.invalid` TLD. That TLD is
 * reserved and by definition never resolves, so nothing can be delivered to it and
 * no address ever leaks to a real party. Nothing is ever sent by email.
 *
 * `users.invalid` is not interchangeable with a real mail provider: these accounts
 * cannot receive mail, which is why there is no confirmation or password-reset flow.
 */
export const USERNAME_DOMAIN = 'users.invalid'

export const MIN_PASSWORD_LENGTH = 8
export const MIN_USERNAME_LENGTH = 3
export const MAX_USERNAME_LENGTH = 32

/**
 * Applied after normalisation, so it only ever sees lowercase. Forbidding `@`
 * here is what stops a crafted username from escaping the synthetic domain.
 */
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/

/**
 * Case-folds the username. Without this, `Alice` and `alice` would register as two
 * separate accounts with two separate passwords, which is an impersonation hole
 * rather than a cosmetic issue.
 */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase()
}

export function usernameProblem(value: string): string | null {
  const username = normalizeUsername(value)

  if (username.length < MIN_USERNAME_LENGTH) {
    return `be at least ${MIN_USERNAME_LENGTH} characters`
  }

  if (username.length > MAX_USERNAME_LENGTH) {
    return `be at most ${MAX_USERNAME_LENGTH} characters`
  }

  if (!USERNAME_PATTERN.test(username)) {
    return 'use only letters, numbers, dots, dashes, and underscores'
  }

  return null
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${USERNAME_DOMAIN}`
}

/** Inverse of {@link usernameToEmail}, for display. Null for any other address. */
export function emailToUsername(email: string | null | undefined): string | null {
  if (!email) return null

  const suffix = `@${USERNAME_DOMAIN}`
  if (!email.toLowerCase().endsWith(suffix)) return null

  const username = email.slice(0, -suffix.length).toLowerCase()

  // Having our domain is not enough on its own. Re-checking the local part means a
  // crafted address like `x@evil.com@users.invalid` yields nothing rather than a
  // bogus name to render.
  return USERNAME_PATTERN.test(username) ? username : null
}

/**
 * Only same-origin relative paths are accepted as a post-auth destination, so a
 * crafted `next` value cannot bounce a freshly signed-in user off-site.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  if (value.startsWith('/login') || value.startsWith('/signup')) return '/'

  return value
}

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `be at least ${MIN_PASSWORD_LENGTH} characters`
  if (!/[a-zA-Z]/.test(password)) return 'contain at least one letter'
  if (!/[0-9]/.test(password)) return 'contain at least one number'

  return null
}