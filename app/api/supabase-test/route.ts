import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseEnvProblems } from '@/lib/supabase/env'

export async function GET() {
  // Uses the same check as the rest of the app, so this endpoint cannot report
  // "ready" for a configuration the proxy would refuse to serve.
  const problems = supabaseEnvProblems()

  if (problems.length > 0) {
    return NextResponse.json(
      {
        status: 'unconfigured',
        connected: false,
        message: 'Supabase environment variables are missing or still placeholders',
        details: problems,
        instruction:
          'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in .env.local, or in the hosting platform for a deployment, then rebuild. Values from Supabase Dashboard -> Project Settings -> API. Then execute supabase/schema.sql in the SQL Editor.',
      },
      { status: 200 }
    )
  }

  try {
    const supabase = await createClient()

    // Test query against categories table
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name')
      .limit(5)

    if (catError) {
      return NextResponse.json(
        {
          status: 'connected_with_schema_missing',
          connected: true,
          message:
            'Successfully connected to Supabase API, but database tables are not yet created.',
          databaseError: catError.message,
          instruction:
            'Run the SQL scripts in supabase/schema.sql and supabase/seed.sql inside your Supabase project SQL Editor.',
        },
        { status: 200 }
      )
    }

    // Also count items
    const { count: itemsCount } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      status: 'ready',
      connected: true,
      message: 'Supabase database connection verified successfully!',
      categoriesSample: categories,
      totalItemsInDb: itemsCount ?? 0,
    })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      {
        status: 'connection_error',
        connected: false,
        error: errorMessage,
      },
      { status: 200 }
    )
  }
}

