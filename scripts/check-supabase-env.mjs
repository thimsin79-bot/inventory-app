/**
 * Checks the Supabase environment validation in lib/supabase/env.ts.
 *
 * There is no test framework in this project, and these helpers decide what a
 * misconfigured deployment reports -- `readSupabaseEnv` throws the message the
 * ConnectionStatus badge and the Supabase clients surface -- so they get a
 * dependency-free check that runs on the Node type stripper. Run with
 * `npm run check:env`.
 *
 * The cases below are deliberate: a blank dashboard variable is `''` rather than
 * `undefined`, and a verbatim copy of .env.example is syntactically valid. Both
 * once slipped through as "configured".
 */

import { pathToFileURL } from 'node:url'

// Type stripping needs a newer Node than the app itself. package.json engines is
// left alone deliberately, because the hosting platform reads it, so fail loudly
// rather than surfacing a syntax error or skipping the check quietly.
const [major, minor] = process.versions.node.split('.').map(Number)

if (major < 22 || (major === 22 && minor < 6)) {
  console.error(
    `check:env needs Node >= 22.6 for TypeScript type stripping (running ${process.versions.node}).`,
  )
  console.error(
    'The application itself still builds on the version in package.json engines; only this check needs newer.',
  )
  process.exit(1)
}

const env = await import(
  pathToFileURL(`${import.meta.dirname}/../lib/supabase/env.ts`).href
)

const URL_VAR = 'NEXT_PUBLIC_SUPABASE_URL'
const PUB_VAR = 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
const ANON_VAR = 'NEXT_PUBLIC_SUPABASE_ANON_KEY'

function setEnv(values) {
  for (const key of [URL_VAR, PUB_VAR, ANON_VAR]) delete process.env[key]
  for (const [key, value] of Object.entries(values)) process.env[key] = value
}

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

/** readSupabaseEnv throws by design, so assertions on it must not abort the run. */
function read(fn) {
  try {
    return { value: fn(), threw: false }
  } catch (error) {
    return { threw: true, message: error instanceof Error ? error.message : String(error) }
  }
}

const GOOD_URL = 'https://bktxyfyduweokmsnmfai.supabase.co'

console.log('publishable key only, the shape current Supabase docs produce')
setEnv({ [URL_VAR]: GOOD_URL, [PUB_VAR]: 'sb_publishable_x' })
check('no problems', env.supabaseEnvProblems().length === 0)
check('reads publishable key', read(env.readSupabaseEnv).value?.key === 'sb_publishable_x')
check('reads url', read(env.readSupabaseEnv).value?.url === GOOD_URL)

console.log('legacy anon key only')
setEnv({ [URL_VAR]: GOOD_URL, [ANON_VAR]: 'legacy-anon' })
check('no problems', env.supabaseEnvProblems().length === 0)
check('falls back to anon', read(env.readSupabaseEnv).value?.key === 'legacy-anon')

console.log('both present, publishable wins')
setEnv({ [URL_VAR]: GOOD_URL, [PUB_VAR]: 'pub', [ANON_VAR]: 'anon' })
check('prefers publishable', read(env.readSupabaseEnv).value?.key === 'pub')

console.log('publishable blank, falls back to anon')
setEnv({ [URL_VAR]: GOOD_URL, [PUB_VAR]: '', [ANON_VAR]: 'anon' })
check('no problems reported', env.supabaseEnvProblems().length === 0)
check('does not pick empty publishable', read(env.readSupabaseEnv).value?.key === 'anon')

console.log('url blank, key present')
setEnv({ [URL_VAR]: '', [PUB_VAR]: 'sb_publishable_x' })
check('flags missing url', env.supabaseEnvProblems().some((p) => /not set/.test(p)))

console.log('nothing set, the production failure')
setEnv({})
const problems = env.supabaseEnvProblems()
check('reports 2 problems', problems.length === 2)
check('names the url variable', problems.some((p) => p.includes(URL_VAR)))
check('names both key variables', problems.some((p) => p.includes(PUB_VAR) && p.includes(ANON_VAR)))
check('reveals no values', problems.every((p) => !p.includes('sb_') && !p.includes('eyJ')))
const thrown = read(env.readSupabaseEnv)
check('readSupabaseEnv throws', thrown.threw)
check('message is actionable', /not configured/i.test(thrown.message ?? ''))

console.log('malformed url')
setEnv({ [URL_VAR]: 'not-a-url', [PUB_VAR]: 'sb_publishable_x' })
check('flags invalid url', env.supabaseEnvProblems().some((p) => /not a valid/i.test(p)))

console.log('verbatim .env.example copy')
setEnv({ [URL_VAR]: 'https://your-project-id.supabase.co', [PUB_VAR]: 'your-publishable-key-here' })
const placeholder = env.supabaseEnvProblems()
check('flags placeholder url', placeholder.some((p) => /placeholder/i.test(p) && p.includes('URL')))
check('flags placeholder key', placeholder.some((p) => /placeholder/i.test(p) && !p.includes('URL')))
check('refuses to build a client', read(env.readSupabaseEnv).threw)

console.log('placeholder url with a real key')
setEnv({ [URL_VAR]: 'https://your-project-id.supabase.co', [PUB_VAR]: 'sb_publishable_x' })
check('flags only the url', env.supabaseEnvProblems().length === 1)

console.log('legacy placeholder markers from the old route check')
setEnv({ [URL_VAR]: 'https://placeholder-project-id.supabase.co', [ANON_VAR]: 'placeholder-anon-key' })
check('still caught', env.supabaseEnvProblems().length === 2)

console.log('real config is not mistaken for a placeholder')
setEnv({ [URL_VAR]: GOOD_URL, [PUB_VAR]: 'sb_publishable_real' })
check('clean', env.supabaseEnvProblems().length === 0)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)