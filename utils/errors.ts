/**
 * Extract a human-readable message from anything thrown.
 * Supabase/PostgREST errors carry a `message`, plain Errors do too.
 */
export function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message
    if (typeof message === 'string' && message.length > 0) return message
  }
  return 'Unexpected error'
}

/**
 * PostgREST reports a missing table as PGRST205. Detect it so the UI can
 * explain that the schema has not been applied yet, instead of dumping a
 * raw error code at the user.
 */
export function isMissingTableError(error: unknown): boolean {
  return errorCode(error) === 'PGRST205'
}

/** Pull the machine-readable `code` off a Supabase/PostgREST error, if any. */
export function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null
  const code = (error as { code: unknown }).code
  return typeof code === 'string' ? code : null
}