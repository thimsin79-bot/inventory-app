/**
 * Browser-only sign-in flag for the /login screen.
 *
 * Page-only by default; turned into a client-side gate on 2026-10-10 by
 * explicit request: a successful `/login` stores a flag here and the `(app)`
 * layout redirects to `/login` pre-paint when the flag is missing. This is a
 * UX entry gate, NOT a security boundary: the flag lives in the user's own
 * browser (they can clear or fake it), the RLS policies are still `TO anon`,
 * and everything stays readable through the publishable key. The database
 * knows nothing about it.
 */

export const SESSION_STORAGE_KEY = 'inventory.signedIn'

export type Session = {
  name: string
}

/**
 * Runs before paint on every (app) screen. Redirects to /login the moment JSON
 * is missing, so an unopened app cannot flash its shell at someone who has not
 * signed in. A storage failure counts as signed-out (fail closed).
 */
export const GATE_INIT_SCRIPT = `(function(){try{if(!localStorage.getItem('${SESSION_STORAGE_KEY}')){window.location.replace('/login')}}catch(e){window.location.replace('/login')}})()`

export function readSession(): Session | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed.name === 'string' ? { name: parsed.name } : null
  } catch {
    return null
  }
}

export function writeSession(name: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ name }))
  } catch {
    // Storage can throw when disabled. Nothing to do: the gate will simply
    // send the user back to /login.
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // Nothing sensible to do if storage refuses to drop the flag.
  }
}