/**
 * Checks that the RLS policy matrix in supabase/schema.sql agrees with the role
 * model in lib/roles.ts.
 *
 * The two have to agree or the app misbehaves in a way neither one reports on its
 * own: a role the UI believes can write will be refused by the database, or --
 * worse -- a role the UI believes is read-only will be allowed to write. The
 * policies are generated from arrays in the SQL, so this reads those arrays back
 * and diffs them against the TypeScript capabilities.
 *
 * It also checks that every table gets policies, because a table with RLS enabled
 * and no policy denies everything, which is very quiet in a UI that just renders
 * empty tables.
 *
 * Run with `npm run check:rls`.
 */

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const [major, minor] = process.versions.node.split('.').map(Number)

if (major < 22 || (major === 22 && minor < 6)) {
  console.error(
    `check:rls needs Node >= 22.6 for TypeScript type stripping (running ${process.versions.node}).`,
  )
  process.exit(1)
}

const roles = await import(
  pathToFileURL(`${import.meta.dirname}/../lib/roles.ts`).href
)

const schema = readFileSync(
  `${import.meta.dirname}/../supabase/schema.sql`,
  'utf8',
)

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

/** Pulls a `name text[] := ARRAY['a', 'b'];` declaration out of the policy block. */
function arrayLiteral(name) {
  const match = schema.match(
    new RegExp(`${name}\\s+text\\[\\]\\s*:=\\s*ARRAY\\[([^\\]]*)\\]`),
  )

  if (!match) return null

  return match[1]
    .split(',')
    .map((value) => value.trim().replace(/^'|'$/g, ''))
    .filter(Boolean)
}

/** Every `CREATE TABLE IF NOT EXISTS public.<name>` in the file. */
function createdTables() {
  return [...schema.matchAll(/CREATE TABLE IF NOT EXISTS public\.(\w+)/g)].map(
    (match) => match[1],
  )
}

const referenceTables = arrayLiteral('reference_tables') ?? []
const operationalTables = arrayLiteral('operational_tables') ?? []
const readRoles = arrayLiteral('read_roles') ?? []
const referenceRoles = arrayLiteral('reference_rw') ?? []
const operationalRoles = arrayLiteral('operational_rw') ?? []

const EXPECTED_REFERENCE = ['categories', 'suppliers', 'warehouses', 'departments']
const EXPECTED_OPERATIONAL = ['items', 'purchases', 'transactions', 'requests', 'audits']

console.log('every table has a policy')
const tables = createdTables()
check('nine tables are declared', tables.length === 9)
for (const table of [...EXPECTED_REFERENCE, ...EXPECTED_OPERATIONAL]) {
  check(`${table} is declared`, tables.includes(table))
}
for (const table of tables) {
  check(
    `${table} is classified exactly once`,
    [...referenceTables, ...operationalTables].filter((t) => t === table).length === 1,
  )
}

console.log('role lists match lib/roles.ts')
check(
  'read_roles is every known role',
  readRoles.length === roles.ROLES.length &&
    roles.ROLES.every((role) => readRoles.includes(role)),
)
check(
  'reference_rw matches canWriteReference',
  referenceRoles.every(
    (role) =>
      roles.isRole(role) &&
      roles.CAPABILITIES[role].writeReference &&
      roles.CAPABILITIES[role].read,
  ),
)
check(
  'operational_rw matches canWriteOperational',
  operationalRoles.every(
    (role) =>
      roles.isRole(role) &&
      roles.CAPABILITIES[role].writeOperational &&
      roles.CAPABILITIES[role].read,
  ),
)
check(
  'every role that can write is listed for both table kinds or neither',
  roles.ROLES.every((role) => {
    const caps = roles.CAPABILITIES[role]
    const inRef = referenceRoles.includes(role)
    const inOps = operationalRoles.includes(role)

    if (!caps.writeReference && !caps.writeOperational) return !inRef && !inOps
    if (caps.writeReference && caps.writeOperational) return inRef && inOps

    return caps.writeReference ? inRef && !inOps : inOps && !inRef
  }),
)
check(
  'a role missing from RLS would still be denied (fail closed)',
  roles.ROLES.every((role) =>
    readRoles.includes(role) || !(referenceRoles.includes(role) || operationalRoles.includes(role)),
  ),
)

console.log('policies are generated for every command')
for (const command of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
  check(`CREATE POLICY ... FOR ${command} is generated`, schema.includes(`FOR ${command} TO authenticated`))
}
check('policies target authenticated, so anon matches nothing', schema.includes('TO authenticated'))
check('current_role reads app_metadata, not user_metadata', 
  schema.includes("auth.jwt() -> 'app_metadata' ->> 'role'") &&
  !schema.includes("auth.jwt() -> 'user_metadata' ->> 'role'"),
)
check('the role claim is a STABLE function so it is an InitPlan', /current_role\(\)[\s\S]*?LANGUAGE sql\s+STABLE/.test(schema))

console.log('\nlegend')
console.log('  reference  ' + referenceTables.join(', '))
console.log('  operational ' + operationalTables.join(', '))
console.log('  read        ' + readRoles.join(', '))
console.log('  ref write   ' + referenceRoles.join(', '))
console.log('  ops write   ' + operationalRoles.join(', '))

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)