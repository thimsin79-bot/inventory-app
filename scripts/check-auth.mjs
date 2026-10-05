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

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)