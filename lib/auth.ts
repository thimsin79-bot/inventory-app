export type AuthState = {
  error?: string
  message?: string
  email?: string
  name?: string
}

export const MIN_PASSWORD_LENGTH = 8

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value)
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
