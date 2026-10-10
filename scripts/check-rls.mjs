/**
 * Checks the RLS boundary in supabase/schema.sql.
 *
 * The boundary is a single split: every request through PostgREST presents as
 * the `anon` role (the app has no sign-in layer), and the policies below hand
 * that role every command on every table -- the app is deliberately public, and
 * its only gated surface is the Admin Console, which the shared secret guards
 * in the API layer, not here. What this file guards is that the schema and the
 * grants agree with each other -- the agreement is invisible when it breaks: a
 * policy with no grant is `permission denied for table`, and a grant with no
 * policy is zero rows. Both render as an empty table in the UI, which reads as
 * "no data yet" rather than "misconfigured".
 *
 * So it checks that:
 *
 *   - all ten tables are declared and all ten have RLS enabled
 *   - SELECT / INSERT / UPDATE / DELETE policies are generated for every table
 *   - the policies target `anon` and never `authenticated`
 *   - `anon` is granted the same commands the policies cover
 *   - `authenticated` is granted nothing and revoked from every table
 *   - `anon` is revoked first so the grants are the whole truth
 *   - DELETE stays withheld on the three tables no screen can delete from
 *     plus company_settings (four total)
 *   - nothing from the removed role ladder survives (current_role, app_metadata)
 *   - no table is left readable through a `FOR ALL USING (true)` catch-all
 *
 * Run with `npm run check:rls`.
 */

import { readFileSync } from 'node:fs'

const schema = readFileSync(
  `${import.meta.dirname}/../supabase/schema.sql`,
  'utf8',
)

/**
 * The schema with `--` comments and `/* *\/` blocks removed.
 *
 * Assertions below are about what the script *executes*, and the prose in this
 * file names the things it deliberately does not do any more ("no current_role",
 * "not FOR ALL USING (true)"). Matching against the raw text would fail on its own
 * explanation, so the comments come out first. Quote-aware, so a `--` inside a
 * string literal is not mistaken for the start of a comment.
 */
function stripComments(sql) {
  let out = ''
  let quote = null

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i]
    const next = sql[i + 1]

    if (quote) {
      out += char
      if (char === quote) quote = null
      continue
    }

    if (char === "'" || char === '"') {
      quote = char
      out += char
      continue
    }

    if (char === '-' && next === '-') {
      while (i < sql.length && sql[i] !== '\n') i++
      out += '\n'
      continue
    }

    if (char === '/' && next === '*') {
      i += 2
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++
      i++
      continue
    }

    out += char
  }

  return out
}

const sql = stripComments(schema)

const TABLES = [
  'categories',
  'suppliers',
  'warehouses',
  'departments',
  'items',
  'purchases',
  'requests',
  'audits',
  'maintenance',
  'company_settings',
]

/** Tables no screen deletes from, so DELETE is withheld at the grant. */
const NO_DELETE = ['purchases', 'requests', 'audits', 'company_settings']

let passed = 0
let failed = 0

function check(label, condition) {
  if (condition) {
    passed++
    console.log(`  pass  ${label}`)
  } else {
    failed++
    console.log(`  FAIL  ${label}`)
  }
}

console.log('tables')
for (const table of TABLES) {
  check(`${table} is declared`, sql.includes(`CREATE TABLE IF NOT EXISTS public.${table}`))
  check(`${table} has RLS enabled`, sql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`))
}
check(
  'ten tables are declared',
  [...sql.matchAll(/CREATE TABLE IF NOT EXISTS public\.(\w+)/g)].length === TABLES.length,
)

console.log('policies cover every command for anon')
for (const command of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
  check(`CREATE POLICY ... FOR ${command} TO anon is generated`, sql.includes(`FOR ${command} TO anon`))
}
check('every table gets both policies', sql.includes("'read on ' || t") && sql.includes("'write on ' || t"))
check(
  'policies never target authenticated, which must not touch anything',
  !/FOR (SELECT|INSERT|UPDATE|DELETE) TO authenticated/.test(sql),
)

console.log('grants match the policies')
for (const table of TABLES) {
  const expected = NO_DELETE.includes(table)
    ? 'SELECT, INSERT, UPDATE'
    : 'SELECT, INSERT, UPDATE, DELETE'

  check(`${table} is granted ${expected} to anon`, sql.includes(`GRANT ${expected} ON public.${table} TO anon`))
}
check('no table is granted to authenticated', !/GRANT[^;]*TO authenticated/.test(sql))
check(
  'every table is revoked from authenticated',
  TABLES.every((table) => sql.includes(`REVOKE ALL ON public.${table} FROM authenticated`)),
)
check(
  'every table is revoked from anon first, so the grants are the whole truth',
  TABLES.every((table) => sql.includes(`REVOKE ALL ON public.${table} FROM anon`)),
)

console.log('DELETE stays withheld where no screen deletes')
for (const table of NO_DELETE) {
  check(`${table} withholds DELETE`, !new RegExp(`GRANT[^;]*DELETE[^;]*ON public\\.${table} TO`).test(sql))
}
check('items keeps DELETE, the inventory screen deletes items', sql.includes('GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO anon'))

console.log('the removed role ladder leaves nothing behind')
// The teardown statements are allowed; what must not come back is a definition.
check('current_role is never defined', !/CREATE[^;]*FUNCTION[^;]*current_role/i.test(sql))
check('current_role is explicitly dropped', sql.includes('DROP FUNCTION IF EXISTS private.current_role()'))
check('no app_metadata role claim', !sql.includes('app_metadata'))
check('no user_metadata role claim', !sql.includes('user_metadata'))
check('no role list arrays', !/text\[\]\s*:=\s*ARRAY\[\s*'admin'/.test(sql))
check('the private schema is dropped', sql.includes('DROP SCHEMA IF EXISTS private CASCADE'))

console.log('no permissive catch-all')
check('no FOR ALL USING (true)', !/FOR ALL USING \(true\)/i.test(sql))
check(
  'policies are explicit per command',
  !/FOR ALL\b/i.test(sql),
)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)