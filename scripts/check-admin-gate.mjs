/**
 * Checks the Admin Console gate in lib/adminGate.ts and the two route files
 * that call it.
 *
 * There is no authentication in this app, so this gate is the only thing
 * standing between any visitor and the Management-API PAT behind
 * /api/admin/users. It is therefore the one guard whose failure is silent:
 * a route that forgets to call it answers 200 with a full user list, and
 * nothing in the UI looks different. The assertions below cover both halves
 * of that — the decision function itself (fail closed, timing-safe, trims)
 * and the wiring in the route files, because a correct helper that is not
 * called is the same as no gate at all.
 *
 * Run with `npm run check:gate`.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const [major, minor] = process.versions.node.split('.').map(Number)

if (major < 22 || (major === 22 && minor < 6)) {
  console.error(
    `check:gate needs Node >= 22.6 for TypeScript type stripping (running ${process.versions.node}).`,
  )
  process.exit(1)
}

const root = `${import.meta.dirname}/..`

const gate = await import(pathToFileURL(`${root}/lib/adminGate.ts`).href)

const LIST_ROUTE = `${root}/app/api/admin/users/route.ts`
const ITEM_ROUTE = `${root}/app/api/admin/users/[id]/route.ts`
const SERVICE = `${root}/services/adminUsersService.ts`

const listSource = readFileSync(LIST_ROUTE, 'utf8')
const itemSource = readFileSync(ITEM_ROUTE, 'utf8')
const serviceSource = readFileSync(SERVICE, 'utf8')
const gateSource = readFileSync(`${root}/lib/adminGate.ts`, 'utf8')
const exampleSource = readFileSync(`${root}/.env.example`, 'utf8')

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

function requestWith(headers = {}) {
  return new Request('https://example.test/api/admin/users', { headers })
}

function gateWith(headers, env) {
  const previous = process.env.ADMIN_CONSOLE_SECRET
  if (env === undefined) delete process.env.ADMIN_CONSOLE_SECRET
  else process.env.ADMIN_CONSOLE_SECRET = env
  try {
    return gate.adminSecretGate(requestWith(headers))
  } finally {
    if (previous === undefined) delete process.env.ADMIN_CONSOLE_SECRET
    else process.env.ADMIN_CONSOLE_SECRET = previous
  }
}

const SECRET = 'b8f0d1c2e3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2'

console.log('the gate fails closed')
check('missing env refuses with 503', gateWith({ 'x-admin-secret': SECRET })?.status === 503)
check('blank env refuses with 503', gateWith({ 'x-admin-secret': SECRET }, '   ')?.status === 503)
check(
  'the refusal names the variable',
  /ADMIN_CONSOLE_SECRET/.test(gateWith({})?.message ?? ''),
)

console.log('the decision on the header')
check('no header is 401', gateWith({}, SECRET)?.status === 401)
check('wrong header is 401', gateWith({ 'x-admin-secret': 'nope' }, SECRET)?.status === 401)
check(
  'a prefix of the secret is 401',
  gateWith({ 'x-admin-secret': SECRET.slice(0, -1) }, SECRET)?.status === 401,
)
check('the right header passes', gateWith({ 'x-admin-secret': SECRET }, SECRET) === null)
check(
  'pasted whitespace is tolerated on both sides',
  gateWith({ 'x-admin-secret': ` ${SECRET}\n` }, ` ${SECRET} `) === null,
)
check(
  'the refusal never reveals the expected value',
  !((gateWith({ 'x-admin-secret': 'wrong' }, SECRET)?.message ?? '').includes(SECRET)),
)

console.log('the comparison is timing-safe')
check('timingSafeEqual is used', /timingSafeEqual/.test(gateSource))
check('both sides are hashed to equal length', /createHash\('sha256'\)/.test(gateSource))

console.log('both route files call the gate')
for (const [name, source] of [
  ['users/route.ts', listSource],
  ['users/[id]/route.ts', itemSource],
]) {
  check(`${name} imports it`, source.includes("from '@/lib/adminGate'"))
  const handlers = source.match(/export async function (GET|POST|PATCH|DELETE)\(/g) ?? []
  const calls = source.match(/adminSecretGate\(request\)/g) ?? []
  check(
    `${name} calls it once per handler (${handlers.length})`,
    handlers.length > 0 && calls.length === handlers.length,
  )
}

console.log('the gate runs before any credential is used')
for (const [name, source] of [
  ['users/route.ts', listSource],
  ['users/[id]/route.ts', itemSource],
]) {
  const gateAt = source.indexOf('adminSecretGate(request)')
  const credAt = source.search(/listAuthUsers\(|createAuthUser\(|updateAuthUser\(|deleteAuthUser\(/)
  check(`${name} gates first`, gateAt > -1 && (credAt === -1 || gateAt < credAt))
}

console.log('the secret never reaches the browser')
const clientFiles = readdirSync(root, { recursive: true, encoding: 'utf8' })
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .filter((file) => !file.startsWith('node_modules'))
  .filter((file) => !file.startsWith('.next'))
  .filter((file) => !file.startsWith('lib\\adminGate.ts') && file !== 'lib/adminGate.ts')

const leaked = clientFiles.filter((file) => {
  const source = readFileSync(`${root}/${file}`, 'utf8')
  return /NEXT_PUBLIC_ADMIN/.test(source) || /process\.env\.ADMIN_CONSOLE_SECRET/.test(source)
})
check('no file outside lib/adminGate.ts reads the secret', leaked.length === 0)
check(
  'it is never given a NEXT_PUBLIC_ prefix',
  !/NEXT_PUBLIC_[A-Z_]*ADMIN_SECRET/.test(exampleSource + gateSource + serviceSource),
)
check('.env.example documents it', /ADMIN_CONSOLE_SECRET=/.test(exampleSource))

console.log('the client sends the same header the server reads')
check(
  'header names match',
  serviceSource.includes(`'${gate.ADMIN_SECRET_HEADER}'`) &&
    gateSource.includes(`'${gate.ADMIN_SECRET_HEADER}'`),
)
check(
  'a 401 turns into a lock the screen can detect',
  /class AdminSecretError/.test(serviceSource) && /ADMIN_SECRET/.test(serviceSource),
)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
