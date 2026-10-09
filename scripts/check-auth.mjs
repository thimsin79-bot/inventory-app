/**
 * Checks the sign-in and permission layer.
 *
 * Auth in this app is a chain, and each link is only as strong as the next:
 *
 *   - `proxy.ts` refuses browsers without a session (redirect to /sign-in) and
 *     answers signed-out API requests with a 403 body
 *   - `ScreenGate` + `Nav` hide screens and links behind the user's
 *     `app_metadata.permissions`, and the write screens hide their create/edit
 *     actions behind the matching `*view` + `<screen>.manage` pair
 *   - the Admin Console routes check `adminSecretGate` (shared secret) and then
 *     `permissionCheck` (session + permission) before touching the Management API
 *   - RLS (checked by check-rls.mjs) seals the actual data to `authenticated`
 *
 * The failure each guard catches is silent: a screen that forgets its gate just
 * looks like it never loads, a route that forgets `permissionCheck` answers 200
 * because the shared-secret gate already passed. So this file asserts both the
 * decision helpers (imported and run for real) and the wiring (read as source).
 *
 * Run with `npm run check:auth`.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const [major, minor] = process.versions.node.split('.').map(Number)

if (major < 22 || (major === 22 && minor < 6)) {
  console.error(
    `check:auth needs Node >= 22.6 for TypeScript type stripping (running ${process.versions.node}).`,
  )
  process.exit(1)
}

const root = `${import.meta.dirname}/..`

const permissions = await import(pathToFileURL(`${root}/lib/permissions.ts`).href)
const gate = await import(pathToFileURL(`${root}/lib/permissionGate.ts`).href)

const read = (rel) => readFileSync(`${root}/${rel}`, 'utf8')

const proxySource = read('proxy.ts')
const signInSource = read('app/sign-in/page.tsx')
const listRoute = read('app/api/admin/users/route.ts')
const itemRoute = read('app/api/admin/users/[id]/route.ts')
const navSource = read('components/Nav.tsx')
const providerSource = read('components/AuthProvider.tsx')
const userMenuSource = read('components/UserMenu.tsx')
const screenGateSource = read('components/ScreenGate.tsx')

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

console.log('the session helpers')
const userWithView = {
  sub: '11111111-1111-1111-1111-111111111111',
  email: 'a@example.com',
  app_metadata: { permissions: ['inventory.view', 'not-a-real-key', 'admin.view'] },
}
check(
  'sessionFromAuth reduces claims-style input to a SessionUser',
  permissions.sessionFromAuth(userWithView)?.permissions.join(',') === 'inventory.view,admin.view',
)
check(
  'client-style input (id, not sub) is accepted',
  permissions.sessionFromAuth({ id: 'x', email: 'b@example.com', app_metadata: { permissions: ['dashboard.view'] } })
    ?.id === 'x',
)
check(
  'unknown permission keys are dropped, catalog order is kept',
  (permissions.sessionFromAuth(userWithView)?.permissions ?? []).every((k) =>
    permissions.ALL_PERMISSIONS.includes(k),
  ),
)
check(
  'user_metadata is never read, only app_metadata',
  permissions.sessionFromAuth({
    sub: 'x',
    user_metadata: { permissions: ['dashboard.view'] },
    app_metadata: { permissions: [] },
  })?.permissions.length === 0,
)
check('no id means nobody', permissions.sessionFromAuth({ email: 'x@y.z' }) === null)
check('null input means nobody', permissions.sessionFromAuth(null) === null)

console.log('the permission decision fails closed')
check(
  'no session refuses 403 as sign-in required',
  gate.permissionGate(null, 'inventory.view')?.status === 403 &&
    gate.permissionGate(null, 'inventory.view')?.message === 'Sign-in required.',
)
const missing = gate.permissionGate({ id: 'x', email: '', permissions: [] }, 'inventory.view')
check('missing permission refuses with the key named', missing?.status === 403 && /inventory\.view/.test(missing?.message ?? ''))
check(
  'holding the permission passes',
  gate.permissionGate({ id: 'x', email: '', permissions: ['inventory.view'] }, 'inventory.view') === null,
)
check('403, never 401: 401 is reserved for the admin console secret', missing?.status !== 401)

console.log('proxy.ts is the sign-in gate')
check('proxy.ts exists at project root', /proxy\.ts/.test(readdirSync(root, { encoding: 'utf8' }).join('\n')))
check('it exports a proxy function', /export async function proxy\(/.test(proxySource))
check('it uses getClaims, not the raw cookie', /getClaims\(\)/.test(proxySource))
check('signed-out pages redirect to /sign-in', /NextResponse\.redirect\(new URL\(SIGN_IN_PATH, request\.url\)\)/.test(proxySource))
check(
  'signed-out API paths get a 403 JSON body',
  /pathname\.startsWith\('\/api\/'\)/.test(proxySource) && /status: 403/.test(proxySource),
)
check('a signed-in visit to /sign-in redirects home', /new URL\('\/', request\.url\)/.test(proxySource))
check('refreshed cookies ride along on redirects', /withSessionCookies/.test(proxySource))
check('the matcher excludes _next', /_next/.test(proxySource))
check('the matcher covers /api', /api/.test(proxySource))

console.log('the sign-in page')
check('app/sign-in/page.tsx exists', signInSource.includes('SignInForm'))
check('it is a server page with metadata', signInSource.includes('export default function SignInPage') && /metadata: Metadata/.test(signInSource))

console.log('the screens are gated')
const screens = [
  { rel: 'app/(app)/page.tsx', view: 'dashboard.view', manage: null },
  { rel: 'app/(app)/inventory/page.tsx', view: 'inventory.view', manage: 'inventory.manage' },
  { rel: 'app/(app)/purchases/page.tsx', view: 'purchases.view', manage: 'purchases.manage' },
  { rel: 'app/(app)/transactions/page.tsx', view: 'transactions.view', manage: null },
  { rel: 'app/(app)/requests/page.tsx', view: 'requests.view', manage: 'requests.manage' },
  { rel: 'app/(app)/audits/page.tsx', view: 'audits.view', manage: 'audits.manage' },
  { rel: 'app/(app)/categories/page.tsx', view: 'categories.view', manage: null },
  { rel: 'app/(app)/warehouses/page.tsx', view: 'warehouses.view', manage: null },
  { rel: 'app/(app)/suppliers/page.tsx', view: 'suppliers.view', manage: null },
  { rel: 'app/(app)/departments/page.tsx', view: 'departments.view', manage: null },
  { rel: 'app/(app)/admin/users/page.tsx', view: 'admin.view', manage: 'admin.manage' },
]
for (const { rel, view, manage } of screens) {
  const source = read(rel)
  check(`${rel} gates on ${view}`, source.includes(`<ScreenGate permission="${view}"`))
  if (manage) {
    check(`${rel} gates write actions on ${manage}`, source.includes(`can('${manage}')`))
  }
}

console.log('the nav and the app shell')
check('Nav links carry a permission', /permission: '/.test(navSource))
check('Nav hides links the user cannot open', /\.filter\(\(link\) => can\(link\.permission\)\)/.test(navSource))
check(
  'AuthProvider reads app_metadata only once and listens once',
  /onAuthStateChange/.test(providerSource) && /sessionFromAuth\(session\.user\)/.test(providerSource),
)
check(
  'ScreenGate renders spinner, refusal and children',
  /Spinner label="Checking access"/.test(screenGateSource) && /No access to this screen/.test(screenGateSource),
)
check('UserMenu signs out to /sign-in', /signOut\(\)/.test(userMenuSource) && /router\.replace\('\/sign-in'\)/.test(userMenuSource))

console.log('the admin routes gate the session too')
check(
  'GET on the users list requires admin.view',
  listRoute.includes("permissionCheck('admin.view')"),
)
check(
  'POST on the users list requires admin.manage',
  listRoute.includes("permissionCheck('admin.manage')"),
)
for (const [name, source, key] of [
  ['users/route.ts', listRoute, 'admin.view'],
  ['users/[id]/route.ts', itemRoute, 'admin.manage'],
]) {
  const gateAt = source.indexOf('adminSecretGate(request)')
  const permAt = source.indexOf(`${key}`)
  const credAt = source.search(/listAuthUsers\(|createAuthUser\(|updateAuthUser\(|deleteAuthUser\(/)
  check(`${name} checks the shared secret, then the permission, then the credential`,
    gateAt > -1 && gateAt < permAt && (credAt === -1 || permAt < credAt))
}

console.log('no user_metadata leaks into the client')
const files = readdirSync(root, { recursive: true, encoding: 'utf8' })
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .filter((file) => !file.startsWith('node_modules'))
  .filter((file) => !file.startsWith('.next'))
  .filter((file) => !file.startsWith('lib\\permissions.ts') && file !== 'lib/permissions.ts')
const readingUserMetadata = files.filter((file) => /\.user_metadata/.test(readFileSync(`${root}/${file}`, 'utf8')))
check('nothing outside lib/permissions.ts reads user_metadata', readingUserMetadata.length === 0)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)