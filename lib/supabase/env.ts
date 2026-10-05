/**
 * Validation for the Supabase environment variables.
 *
 * Every entry point (proxy, server client, browser client) used to assert these
 * with `process.env.X!`, which is a compile-time-only check. A missing variable
 * therefore reached the Supabase SDK as `undefined` and surfaced as an opaque
 * throw, so a misconfigured deployment looked like an application bug.
 *
 * These helpers report *names* only. Values never pass through here, so every
 * string they return is safe to log or send in an HTTP response.
 */

const KEY_VARIABLES = [
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const

export type SupabaseEnv = {
  url: string
  key: string
}

/**
 * The key is read from the publishable key in preference to the legacy alias,
 * because Supabase is deprecating the `anon` key. Either one is accepted so a
 * project set up from the current docs, which only defines a publishable key,
 * still works.
 *
 * Uses `||` rather than `??` so an empty string counts as unset. A blank
 * dashboard variable, or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` in an env file,
 * yields `''` rather than `undefined`, and `??` would hand that to the SDK.
 */
function readKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined
}

/** Human-readable reasons the environment is unusable. Empty means usable. */
export function supabaseEnvProblems(): string[] {
  const problems: string[] = []
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!url) {
    problems.push('NEXT_PUBLIC_SUPABASE_URL is not set')
  } else if (!/^https?:\/\/\S+\.\S+/.test(url)) {
    problems.push('NEXT_PUBLIC_SUPABASE_URL is not a valid http(s) URL')
  }

  if (!readKey()) {
    problems.push(`neither ${KEY_VARIABLES.join(' nor ')} is set`)
  }

  return problems
}

const REBUILD_NOTE =
  'NEXT_PUBLIC_* values are inlined at build time, so a deployment needs a rebuild rather than a restart.'

/** One-line explanation, or an empty string when the environment is usable. */
export function unconfiguredErrorMessage(): string {
  const problems = supabaseEnvProblems()

  if (problems.length === 0) return ''

  return `Supabase is not configured: ${problems.join('; ')}. ${REBUILD_NOTE}`
}

/** Plain-text body for the proxy response, so it is readable in a browser. */
export function unconfiguredMessage(problems: string[]): string {
  return [
    'Supabase is not configured on this deployment.',
    '',
    ...problems.map((problem) => `  - ${problem}`),
    '',
    REBUILD_NOTE,
    '',
    'Public paths are still served, and /api/supabase-test reports the same details.',
  ].join('\n')
}

/**
 * Returns the validated environment, or throws an error naming exactly what is
 * missing so the failure is actionable without exposing any value.
 */
export function readSupabaseEnv(): SupabaseEnv {
  const message = unconfiguredErrorMessage()

  if (message) throw new Error(message)

  return { url: process.env.NEXT_PUBLIC_SUPABASE_URL as string, key: readKey() as string }
}