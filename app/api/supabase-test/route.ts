import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY

  const isConfigured =
    url &&
    anonKey &&
    !url.includes('placeholder-project-id') &&
    anonKey !== 'placeholder-anon-key'

  if (!isConfigured) {
    return NextResponse.json(
      {
        status: 'unconfigured',
        connected: false,
        message:
          'Supabase environment variables are missing or set to placeholders in .env.local',
        details: {
          NEXT_PUBLIC_SUPABASE_URL: url || 'MISSING',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey ? '[PROVIDED]' : 'MISSING',
          SUPABASE_SERVICE_ROLE_KEY: hasServiceRole ? '[PROVIDED]' : 'NOT SET (optional)',
        },
        instruction:
          'Please update NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local with values from your Supabase Dashboard (Settings -> API), and execute supabase/schema.sql in the SQL Editor.',
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
      { status: 500 }
    )
  }
}

