import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting database export via API route...')

    // Get environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY

    if (!supabaseUrl || !serviceKey) {
      console.error('❌ Missing required environment variables')
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables' 
        },
        { status: 500 }
      )
    }

    // Construct the Edge Function URL
    const functionUrl = `${supabaseUrl}/functions/v1/save-db-tables`
    
    console.log(`📡 Calling Edge Function: ${functionUrl}`)

    // Call the Supabase Edge Function
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    const responseText = await response.text()
    console.log(`📊 Edge Function response status: ${response.status}`)
    console.log(`📄 Edge Function response: ${responseText}`)

    if (!response.ok) {
      console.error(`❌ Edge Function failed with status ${response.status}`)
      return NextResponse.json(
        { 
          success: false, 
          error: `Edge Function failed: ${response.status} ${response.statusText}`,
          details: responseText
        },
        { status: response.status }
      )
    }

    // Parse the response
    let result
    try {
      result = JSON.parse(responseText)
    } catch (parseError) {
      console.error('❌ Failed to parse Edge Function response:', parseError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to parse Edge Function response',
          rawResponse: responseText
        },
        { status: 500 }
      )
    }

    console.log('✅ Database export completed successfully via API route')
    
    return NextResponse.json({
      success: true,
      message: 'Database export completed successfully',
      exportFolder: result.exportFolder,
      timestamp: result.timestamp,
      edgeFunctionResponse: result
    })

  } catch (error) {
    console.error('❌ Database export failed:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Also support GET requests for convenience
export async function GET(request: NextRequest) {
  console.log('📥 GET request received, redirecting to POST...')
  return POST(request)
}
