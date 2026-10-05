/**
 * Checks the username helpers in lib/auth.ts.
 *
 * These map a username onto a synthetic @users.invalid address that stands in for
 * an email in Supabase Auth. Two properties matter and are easy to regress:
 * case folding, so `Alice` and `alice` cannot become two accounts, and rejecting
 * `@`, so a crafted username cannot escape the synthetic domain.
 *
 * Run with `npm run check:auth`.
 */

import { pathToFileURL } from 'node:url'

const [major, minor] = process.versions.node.split('.').map(Number)

if (major < 22 || (major === 22 && minor < 6)) {
  console.error(
    `check:auth needs Node >= 22.6 for TypeScript type stripping (running ${process.versions.node}).`,
  )
  process.exit(1)
}

const auth = await import(
  pathToFileURL(`${import.meta.dirname}/../lib/auth.ts`).href
)

const roles = await import(
  pathToFileURL(`${import.meta.dirname}/../lib/roles.ts`).href
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

console.log('normalisation folds case and trims')
check('trims', auth.normalizeUsername('  alice  ') === 'alice')
check('lowercases', auth.normalizeUsername('ALICE') === 'alice')
check('mixed case folds to one form', auth.normalizeUsername('AlIcE') === auth.normalizeUsername('alice'))
check('collapses the impersonation pair', auth.usernameToEmail('Alice') === auth.usernameToEmail('alice'))

console.log('accepted usernames')
for (const good of ['abc', 'alice', 'a.b', 'a-b', 'a_b', 'user123', 'a'.repeat(32)]) {
  check(`accepts ${good.length > 12 ? `${good.slice(0, 4)}...(${good.length})` : good}`, auth.usernameProblem(good) === null)
}

console.log('rejected usernames')
check('too short', auth.usernameProblem('ab') !== null)
check('too long', auth.usernameProblem('a'.repeat(33)) !== null)
check('empty', auth.usernameProblem('') !== null)
check('whitespace only', auth.usernameProblem('   ') !== null)
check('contains @', auth.usernameProblem('a@b') !== null)
check('injected address', auth.usernameProblem('x@evil.com') !== null)
check('inner space', auth.usernameProblem('a b') !== null)
check('leading dot', auth.usernameProblem('.alice') !== null)
check('leading dash', auth.usernameProblem('-alice') !== null)
check('slash', auth.usernameProblem('a/b') !== null)
check('plus alias', auth.usernameProblem('alice+bob') !== null)

console.log('synthetic domain')
check('domain is the reserved .invalid TLD', auth.USERNAME_DOMAIN === 'users.invalid')
check('maps to synthetic address', auth.usernameToEmail('alice') === 'alice@users.invalid')
check('case folds on the way in', auth.usernameToEmail('  ALICE ') === 'alice@users.invalid')
check('result stays inside the domain for a valid username', (() => {
  const [local, domain] = auth.usernameToEmail('alice').split('@')
  return domain === auth.USERNAME_DOMAIN && local === 'alice'
})())

console.log('reverse mapping')
check('round trips', auth.emailToUsername(auth.usernameToEmail('alice')) === 'alice')
check('round trips a dotted name', auth.emailToUsername(auth.usernameToEmail('a.b-c_d')) === 'a.b-c_d')
check('rejects a real address', auth.emailToUsername('alice@example.com') === null)
check('rejects a lookalike suffix', auth.emailToUsername('alice@evil.com@users.invalid') === null)
check('rejects a suffix-only match', auth.emailToUsername('@users.invalid') === null)
check('handles null', auth.emailToUsername(null) === null)
check('handles undefined', auth.emailToUsername(undefined) === null)

console.log('post-auth redirect guard')
check('rejects absolute urls', auth.safeNextPath('https://evil.com') === '/')
check('rejects protocol-relative urls', auth.safeNextPath('//evil.com') === '/')
check('rejects a loop back to login', auth.safeNextPath('/login') === '/')
check('rejects a loop back to signup', auth.safeNextPath('/signup') === '/')
check('keeps a same-origin path', auth.safeNextPath('/items?page=2') === '/items?page=2')

console.log('role comes from app_metadata, never user_metadata')
check('admin in app_metadata passes', roles.isAdmin({ app_metadata: { role: 'admin' } }))
check('no role is not admin', roles.isAdmin({ app_metadata: {} }) === false)
check('empty metadata is not admin', roles.isAdmin({}) === false)
check('null metadata is not admin', roles.isAdmin({ app_metadata: null }) === false)
check('staff is not admin', roles.isAdmin({ app_metadata: { role: 'staff' } }) === false)
check('viewer is not admin', roles.isAdmin({ app_metadata: { role: 'viewer' } }) === false)
check('roleOf reads through', roles.roleOf({ app_metadata: { role: 'staff' } }) === 'staff')
check('roleOf returns null when absent', roles.roleOf({ app_metadata: {} }) === null)
check('roleOf ignores a non-string role', roles.roleOf({ app_metadata: { role: 1 } }) === null)
check('roleOf ignores an object role', roles.roleOf({ app_metadata: { role: {} } }) === null)
check(
  'ESCALATION: admin set via user_metadata does NOT pass',
  roles.isAdmin({ user_metadata: { role: 'admin' } }) === false,
)
check(
  'ESCALATION: user_metadata admin alongside app_metadata staff does NOT pass',
  roles.isAdmin({ app_metadata: { role: 'staff' }, user_metadata: { role: 'admin' } }) === false,
)
check(
  'ESCALATION: case-variant Admin is not accepted',
  roles.isAdmin({ app_metadata: { role: 'Admin' } }) === false,
)
check(
  'ESCALATION: padded " admin " is not accepted',
  roles.isAdmin({ app_metadata: { role: ' admin ' } }) === false,
)

console.log('the role ladder')
check('viewer is a known role', roles.isRole('viewer'))
check('manager is a known role', roles.isRole('manager'))
check('staff is a known role', roles.isRole('staff'))
check('admin is a known role', roles.isRole('admin'))
check('an unknown role is rejected', roles.isRole('supervisor') === false)
check('an empty role is rejected', roles.isRole('') === false)
check('a non-string is rejected', roles.isRole(7) === false)
check('every ROLES entry is a known role', roles.ROLES.every((r) => roles.isRole(r)))

console.log('capabilities')
check('every role has a capability record', roles.ROLES.every((r) => roles.CAPABILITIES[r]))
check('every role can read', roles.ROLES.every((r) => roles.CAPABILITIES[r].read))
check('viewer cannot write operational data', roles.canWriteOperational({ app_metadata: { role: 'viewer' } }) === false)
check('viewer cannot write reference data', roles.canWriteReference({ app_metadata: { role: 'viewer' } }) === false)
check('viewer cannot manage accounts', roles.canManageAccounts({ app_metadata: { role: 'viewer' } }) === false)
check('staff can write operational data', roles.canWriteOperational({ app_metadata: { role: 'staff' } }) === true)
check('staff CANNOT write reference data', roles.canWriteReference({ app_metadata: { role: 'staff' } }) === false)
check('staff cannot manage accounts', roles.canManageAccounts({ app_metadata: { role: 'staff' } }) === false)
check('manager can write reference data', roles.canWriteReference({ app_metadata: { role: 'manager' } }) === true)
check('manager cannot manage accounts', roles.canManageAccounts({ app_metadata: { role: 'manager' } }) === false)
check('manager is a manager', roles.isManager({ app_metadata: { role: 'manager' } }) === true)
check('admin is a manager', roles.isManager({ app_metadata: { role: 'admin' } }) === true)
check('staff is not a manager', roles.isManager({ app_metadata: { role: 'staff' } }) === false)
check('admin can do everything', roles.ROLES.filter((r) => r === 'admin').every((r) =>
  roles.canRead({ app_metadata: { role: r } }) &&
  roles.canWriteOperational({ app_metadata: { role: r } }) &&
  roles.canWriteReference({ app_metadata: { role: r } }) &&
  roles.canManageAccounts({ app_metadata: { role: r } }),
))

console.log('no role at all')
check('no role means no read', roles.canRead({ app_metadata: {} }) === false)
check('no role means no write', roles.canWriteOperational({ app_metadata: {} }) === false)
check('no role means not admin', roles.isAdmin({ app_metadata: {} }) === false)
check('no role means not a manager', roles.isManager({ app_metadata: {} }) === false)
check('a null claim means no role', roles.roleOf({ app_metadata: null }) === null)
check('no role is labelled', roles.roleLabel({ app_metadata: {} }) === 'No role')

console.log('capabilities fail closed on an unrecognised role')
// A role added to app_metadata but not to ROLES must get nothing, not everything.
for (const claim of ['supervisor', 'Admin', ' admin ', 'ADMIN', 'owner', '']) {
  const user = { app_metadata: { role: claim } }
  check(
    `"${claim}" is denied everything`,
    roles.canRead(user) === false &&
      roles.canWriteOperational(user) === false &&
      roles.canWriteReference(user) === false &&
      roles.canManageAccounts(user) === false &&
      roles.isAdmin(user) === false &&
      roles.isManager(user) === false,
  )
}

console.log('the ladder only widens going up')
for (let i = 1; i < roles.ROLES.length; i++) {
  const lower = roles.ROLES[i]
  const higher = roles.ROLES[i - 1]
  check(
    `${lower} never exceeds ${higher}`,
    Object.keys(roles.CAPABILITIES).every((cap) =>
      roles.CAPABILITIES[higher][cap] || !roles.CAPABILITIES[lower][cap],
    ),
  )
}

console.log('app_metadata merge preserves other claims')
// Replacing app_metadata instead of merging would silently drop a claim written
// by something else. This path normally needs SUPABASE_SERVICE_ROLE_KEY to reach,
// so it is pinned here where it can be checked without one.
check(
  'preserves an unrelated claim',
  JSON.stringify(roles.mergeRoleInto({ provider: 'email' }, 'staff')) ===
    JSON.stringify({ provider: 'email', role: 'staff' }),
)
check(
  'overwrites a previous role',
  roles.mergeRoleInto({ role: 'viewer' }, 'admin').role === 'admin',
)
check(
  'handles a null claim',
  JSON.stringify(roles.mergeRoleInto(null, 'viewer')) === JSON.stringify({ role: 'viewer' }),
)
check(
  'handles a missing claim',
  JSON.stringify(roles.mergeRoleInto(undefined, 'viewer')) === JSON.stringify({ role: 'viewer' }),
)
check('does not mutate its input', (() => {
  const before = { provider: 'email' }
  roles.mergeRoleInto(before, 'admin')
  return JSON.stringify(before) === JSON.stringify({ provider: 'email' })
})())
check(
  'a nested claim survives intact',
  (() => {
    // Optional chaining on purpose: if the merge ever stops preserving the key,
    // this should report a FAIL rather than throw and abort the rest of the run.
    const meta = { onboarding: { done: true }, role: 'viewer' }
    const merged = roles.mergeRoleInto(meta, 'manager')
    return merged.onboarding?.done === true && merged.role === 'manager'
  })(),
)
check(
  'every role round-trips through the merge',
  roles.ROLES.every((role) => roles.mergeRoleInto({}, role).role === role),
)

console.log('the account list projects auth users safely')
const selfId = 'user-1'
const row = (user, derived) => roles.describeAccount(user, selfId, derived)

// The username arrives already derived from the address by lib/auth's
// emailToUsername, which has its own assertions above. What is checked here is
// the fallback chain and the rest of the row.
check(
  'uses the derived username',
  row({ id: 'u1', email: 'alice@users.invalid' }, 'alice').username === 'alice',
)
check(
  'falls back to the address when it is not a synthetic one',
  row({ id: 'u1', email: 'alice@example.com' }, null).username === 'alice@example.com',
)
check('copes with no address at all', row({ id: 'u1' }, null).username === '(unknown)')
check('copes with a null address', row({ id: 'u1', email: null }, null).username === '(unknown)')
check(
  'an unrecognised role shows as no role, not as its raw claim',
  row({ id: 'u1', email: 'a@users.invalid', app_metadata: { role: 'supervisor' } }, 'a').role === null,
)
check(
  'a known role is reported',
  row({ id: 'u1', email: 'a@users.invalid', app_metadata: { role: 'manager' } }, 'a').role === 'manager',
)
check('a role-less account reports null', row({ id: 'u1', email: 'a@users.invalid' }, 'a').role === null)
check(
  'an unconfirmed account is flagged',
  row({ id: 'u1', email: 'a@users.invalid' }, 'a').confirmed === false,
)
check(
  'a confirmed account is not flagged',
  row({ id: 'u1', email: 'a@users.invalid', email_confirmed_at: '2026-01-01' }, 'a').confirmed === true,
)
check(
  'the viewer is recognised as self',
  row({ id: selfId, email: 'a@users.invalid' }, 'a').isSelf === true,
)
check(
  'anyone else is not self',
  row({ id: 'user-2', email: 'b@users.invalid' }, 'b').isSelf === false,
)
check(
  'the role comes from app_metadata even when user_metadata disagrees',
  row(
    { id: 'u1', email: 'a@users.invalid', app_metadata: { role: 'staff' }, user_metadata: { role: 'admin' } },
    'a',
  ).role === 'staff',
)
check(
  'the row carries an id so the form can address the right account',
  row({ id: 'abc-123', email: 'a@users.invalid' }, 'a').id === 'abc-123',
)

console.log('the self-demotion guard')
const me = { id: 'user-1', app_metadata: { role: 'admin' } }
const them = (id, role) => ({ id, app_metadata: role === null ? {} : { role } })
const change = (users, requested, complete = true) =>
  roles.canChangeOwnRole(users, me.id, requested, complete)

check('the viewer can recognise their own account', roles.isSelfAccount('user-1', 'user-1') === true)
check('an admin can change someone else', roles.isSelfAccount('user-2', 'user-1') === false)

console.log('changing your own role is allowed when another admin remains')
check('the last admin cannot step down', change([me], 'viewer').allowed === false)
check('the last admin can still confirm itself admin', change([me], 'admin').allowed === true)
check('one other admin is enough to step down', change([me, them('user-2', 'admin')], 'manager').allowed === true)
check(
  'two other admins is enough',
  change([me, them('user-2', 'admin'), them('user-3', 'admin')], 'viewer').allowed === true,
)

console.log('what counts as another admin')
check('a non-admin does not count', change([me, them('user-2', 'staff')], 'viewer').allowed === false)
check('a role-less account does not count', change([me, them('user-2', null)], 'viewer').allowed === false)
check(
  'a typo in the claim does not count',
  change([me, them('user-2', 'Admin')], 'viewer').allowed === false,
)
check(
  'a user_metadata role does not count -- that field is self-writable',
  change([me, { id: 'user-2', app_metadata: {}, user_metadata: { role: 'admin' } }], 'viewer').allowed === false,
)
check(
  'the viewer is excluded from their own admin tally',
  change([me, me], 'viewer').allowed === false,
)
check(
  'two copies of the viewer are still one account',
  change([me, { ...me }], 'viewer').allowed === false,
)

console.log('an incomplete account list refuses the demotion')
check(
  'a truncated list cannot prove another admin exists',
  change([me, them('user-2', 'admin')], 'viewer', false).allowed === false,
)
check(
  'an incomplete list still permits confirming yourself admin',
  change([me, them('user-2', 'admin')], 'admin', false).allowed === true,
)
check('an empty list means no admin at all', change([], 'admin').allowed === true)

console.log('the refusal explains itself')
check(
  'being the last admin says how to fix it',
  change([me], 'viewer').reason.includes('only admin'),
)
check(
  'an incomplete list says it could not confirm an admin',
  change([me], 'viewer', false).reason.includes('could not be confirmed'),
)
check(
  'an allowed change carries no reason',
  change([me, them('user-2', 'admin')], 'admin').reason === undefined,
)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)