// Database Export Edge Function
// Exports all tables from the public schema to CSV and SQL formats
// and saves them to Supabase Storage bucket

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import "jsr:@supabase/functions-js/edge-runtime.d.ts"


interface TableData {
  [key: string]: unknown
}

// Helper function to escape CSV values
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  
  const stringValue = String(value)
  
  // If the value contains comma, newline, or double quote, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  
  return stringValue
}

// Helper function to convert data to CSV format
function convertToCsv(data: TableData[], columns: string[]): string {
  if (data.length === 0) {
    return columns.join(',')
  }
  
  const csvRows = []
  
  // Add header row
  csvRows.push(columns.map(col => escapeCsvValue(col)).join(','))
  
  // Add data rows
  for (const row of data) {
    const csvRow = columns.map(col => escapeCsvValue(row[col])).join(',')
    csvRows.push(csvRow)
  }
  
  return csvRows.join('\n')
}

// Helper function to generate SQL INSERT statements
function convertToSql(data: TableData[], tableName: string, columns: string[]): string {
  if (data.length === 0) {
    return `-- No data found for table ${tableName}\n`
  }
  
  const sqlStatements = []
  
  // Add table comment
  sqlStatements.push(`-- Data for table: ${tableName}`)
  sqlStatements.push(`-- Generated on: ${new Date().toISOString()}`)
  sqlStatements.push('')
  
  // Generate INSERT statements
  for (const row of data) {
    const values = columns.map(col => {
      const value = row[col]
      if (value === null || value === undefined) {
        return 'NULL'
      }
      
      // Escape single quotes and wrap strings in quotes
      if (typeof value === 'string') {
        return `'${value.replace(/'/g, "''")}'`
      }
      
      // Handle JSON objects
      if (typeof value === 'object') {
        return `'${JSON.stringify(value).replace(/'/g, "''")}'`
      }
      
      return String(value)
    })
    
    const insertStatement = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`
    sqlStatements.push(insertStatement)
  }
  
  return sqlStatements.join('\n')
}


Deno.serve(async () => {
  try {
    console.log('🚀 Starting database export process...')
    
    // Get environment variables
    const supabaseUrl = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('NEXT_PUBLIC_SUPABASE_SERVICE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    // For local development, use the service role key from the local setup
    const serviceKey = supabaseServiceKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
    
    if (!supabaseUrl) {
      throw new Error('Missing required environment variable: SUPABASE_URL')
    }
    
    console.log('✅ Environment variables loaded')
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, serviceKey)
    
    // Create timestamp for folder name
    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const folderName = `db_exports/${timestamp}`
    
    console.log(`📁 Export folder: ${folderName}`)
    
    // Get all tables from public schema
    console.log('📋 Fetching list of tables...')
    const { data: tables, error: tablesError } = await supabase.rpc('get_tables')
    
    if (tablesError) {
      // Fallback: use the tables we know from the schema
      console.log('⚠️ Using fallback method to get tables...')
      const knownTables = [
        'user', 'session', 'account', 'verification', 'category', 'exercices_attempts',
        'exercise_levels', 'exercises', 'filter_preferences', 'generated_questions',
        'levels', 'profile_levels', 'profiles', 'topic', 'topics_levels',
        'dictation', 'dictations_levels', 'dictation_sentence'
      ]
      
      console.log(`📋 Found ${knownTables.length} tables to export`)
      
      // Process each table
      for (const tableName of knownTables) {
        try {
          console.log(`\n🔄 Processing table: ${tableName}`)
          
          // Get table data using Supabase client
          // Get ALL table data using pagination to bypass the 1000 record limit
          let tableData: TableData[] = []
          let from = 0
          const limit = 1000
          let hasMore = true
          let dataError: Error | null = null
          
          console.log(`🔄 Fetching ALL records from table ${tableName}...`)
          
          while (hasMore) {
            const { data: batchData, error: batchError } = await supabase
              .from(tableName)
              .select('*')
              .range(from, from + limit - 1)
            
            if (batchError) {
              dataError = batchError
              break
            }
            
            if (batchData && batchData.length > 0) {
              tableData = tableData.concat(batchData)
              from += limit
              console.log(`📊 Fetched ${batchData.length} records (total: ${tableData.length}) for table ${tableName}`)
              
              // If we got fewer records than the limit, we've reached the end
              if (batchData.length < limit) {
                hasMore = false
              }
            } else {
              hasMore = false
            }
          }
          
          console.log(`📊 Total records fetched: ${tableData.length} for table ${tableName}`)
          
          if (tableData.length > 1000) {
            console.log(`🎉 Successfully bypassed 1000 record limit! Exported ${tableData.length} records`)
          }
          
          if (dataError) {
            console.log(`⚠️ Cannot access table ${tableName}: ${dataError.message}`)
            console.log(`📄 Creating empty files for ${tableName} (permission denied)`)
            
            // Create empty CSV file
            const csvPath = `${folderName}/${tableName}.csv`
            const csvResponse = await fetch(`${supabaseUrl}/storage/v1/object/db_exports/${csvPath}`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'text/csv',
              },
              body: 'Table not accessible due to permissions',
            })
            
            if (!csvResponse.ok) {
              console.error(`❌ Failed to upload empty CSV for ${tableName}: ${csvResponse.status}`)
            } else {
              console.log(`✅ Successfully uploaded empty ${csvPath}`)
            }
            
            // Create empty SQL file
            const sqlPath = `${folderName}/${tableName}.sql`
            const sqlResponse = await fetch(`${supabaseUrl}/storage/v1/object/db_exports/${sqlPath}`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'text/plain',
              },
              body: `-- Table ${tableName} not accessible due to permissions\n-- This is expected in local development\n`,
            })
            
            if (!sqlResponse.ok) {
              console.error(`❌ Failed to upload empty SQL for ${tableName}: ${sqlResponse.status}`)
            } else {
              console.log(`✅ Successfully uploaded empty ${sqlPath}`)
            }
            
            console.log(`✅ Completed empty export for table: ${tableName}`)
            continue
          }
          
          console.log(`📊 Found ${tableData?.length || 0} rows in table ${tableName}`)
          
          if (!tableData || tableData.length === 0) {
            console.log(`⚠️ Table ${tableName} is empty, creating empty files`)
          }
          
          // Get column information
          const columns = tableData && tableData.length > 0 ? Object.keys(tableData[0]) : []
          console.log(`📝 Columns: ${columns.join(', ')}`)
          
          // Generate CSV content
          const csvContent = convertToCsv(tableData || [], columns)
          console.log(`📄 Generated CSV content (${csvContent.length} characters)`)
          
          // Generate SQL content
          const sqlContent = convertToSql(tableData || [], tableName, columns)
          console.log(`📄 Generated SQL content (${sqlContent.length} characters)`)
          
          // Upload CSV file using Supabase client
          const csvPath = `${folderName}/${tableName}.csv`
          const { error: csvUploadError } = await supabase.storage
            .from('db_exports')
            .upload(csvPath, csvContent, {
              contentType: 'text/csv',
              upsert: true
            })
          
          if (csvUploadError) {
            console.error(`❌ Failed to upload CSV for ${tableName}:`, csvUploadError)
          } else {
            console.log(`✅ Successfully uploaded ${csvPath}`)
          }
          
          // Upload SQL file using Supabase client
          const sqlPath = `${folderName}/${tableName}.sql`
          const { error: sqlUploadError } = await supabase.storage
            .from('db_exports')
            .upload(sqlPath, sqlContent, {
              contentType: 'text/plain',
              upsert: true
            })
          
          if (sqlUploadError) {
            console.error(`❌ Failed to upload SQL for ${tableName}:`, sqlUploadError)
          } else {
            console.log(`✅ Successfully uploaded ${sqlPath}`)
          }
          
          console.log(`✅ Completed export for table: ${tableName}`)
          
        } catch (tableError) {
          console.error(`❌ Error processing table ${tableName}:`, tableError)
          // Continue with next table
        }
      }
      
    } else {
      console.log(`📋 Found ${tables?.length || 0} tables to export`)
      
      // Process each table
      for (const table of tables || []) {
        const tableName = table.table_name
        console.log(`\n🔄 Processing table: ${tableName}`)
        
        try {
          // Get table data using Supabase client
          // Get ALL table data using pagination to bypass the 1000 record limit
          let tableData: TableData[] = []
          let from = 0
          const limit = 1000
          let hasMore = true
          let dataError: Error | null = null
          
          console.log(`🔄 Fetching ALL records from table ${tableName}...`)
          
          while (hasMore) {
            const { data: batchData, error: batchError } = await supabase
              .from(tableName)
              .select('*')
              .range(from, from + limit - 1)
            
            if (batchError) {
              dataError = batchError
              break
            }
            
            if (batchData && batchData.length > 0) {
              tableData = tableData.concat(batchData)
              from += limit
              console.log(`📊 Fetched ${batchData.length} records (total: ${tableData.length}) for table ${tableName}`)
              
              // If we got fewer records than the limit, we've reached the end
              if (batchData.length < limit) {
                hasMore = false
              }
            } else {
              hasMore = false
            }
          }
          
          console.log(`📊 Total records fetched: ${tableData.length} for table ${tableName}`)
          
          if (tableData.length > 1000) {
            console.log(`🎉 Successfully bypassed 1000 record limit! Exported ${tableData.length} records`)
          }
          
          if (dataError) {
            console.log(`⚠️ Cannot access table ${tableName}: ${dataError.message}`)
            console.log(`📄 Creating empty files for ${tableName} (permission denied)`)
            
            // Create empty CSV file
            const csvPath = `${folderName}/${tableName}.csv`
            const csvResponse = await fetch(`${supabaseUrl}/storage/v1/object/db_exports/${csvPath}`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'text/csv',
              },
              body: 'Table not accessible due to permissions',
            })
            
            if (!csvResponse.ok) {
              console.error(`❌ Failed to upload empty CSV for ${tableName}: ${csvResponse.status}`)
            } else {
              console.log(`✅ Successfully uploaded empty ${csvPath}`)
            }
            
            // Create empty SQL file
            const sqlPath = `${folderName}/${tableName}.sql`
            const sqlResponse = await fetch(`${supabaseUrl}/storage/v1/object/db_exports/${sqlPath}`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'text/plain',
              },
              body: `-- Table ${tableName} not accessible due to permissions\n-- This is expected in local development\n`,
            })
            
            if (!sqlResponse.ok) {
              console.error(`❌ Failed to upload empty SQL for ${tableName}: ${sqlResponse.status}`)
            } else {
              console.log(`✅ Successfully uploaded empty ${sqlPath}`)
            }
            
            console.log(`✅ Completed empty export for table: ${tableName}`)
            continue
          }
          
          console.log(`📊 Found ${tableData?.length || 0} rows in table ${tableName}`)
          
          if (!tableData || tableData.length === 0) {
            console.log(`⚠️ Table ${tableName} is empty, creating empty files`)
          }
          
          // Get column information
          const columns = tableData && tableData.length > 0 ? Object.keys(tableData[0]) : []
          console.log(`📝 Columns: ${columns.join(', ')}`)
          
          // Generate CSV content
          const csvContent = convertToCsv(tableData || [], columns)
          console.log(`📄 Generated CSV content (${csvContent.length} characters)`)
          
          // Generate SQL content
          const sqlContent = convertToSql(tableData || [], tableName, columns)
          console.log(`📄 Generated SQL content (${sqlContent.length} characters)`)
          
          // Upload CSV file using Supabase client
          const csvPath = `${folderName}/${tableName}.csv`
          const { error: csvUploadError } = await supabase.storage
            .from('db_exports')
            .upload(csvPath, csvContent, {
              contentType: 'text/csv',
              upsert: true
            })
          
          if (csvUploadError) {
            console.error(`❌ Failed to upload CSV for ${tableName}:`, csvUploadError)
          } else {
            console.log(`✅ Successfully uploaded ${csvPath}`)
          }
          
          // Upload SQL file using Supabase client
          const sqlPath = `${folderName}/${tableName}.sql`
          const { error: sqlUploadError } = await supabase.storage
            .from('db_exports')
            .upload(sqlPath, sqlContent, {
              contentType: 'text/plain',
              upsert: true
            })
          
          if (sqlUploadError) {
            console.error(`❌ Failed to upload SQL for ${tableName}:`, sqlUploadError)
          } else {
            console.log(`✅ Successfully uploaded ${sqlPath}`)
          }
          
          console.log(`✅ Completed export for table: ${tableName}`)
          
        } catch (tableError) {
          console.error(`❌ Error processing table ${tableName}:`, tableError)
          // Continue with next table
        }
      }
    }
    
    console.log('\n🎉 Database export completed successfully!')
    console.log(`📁 Files saved to bucket: db_exports/${timestamp}`)
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Database export completed successfully',
        exportFolder: folderName,
        timestamp: timestamp
      }),
      { 
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        },
        status: 200
      }
    )
    
  } catch (error) {
    console.error('❌ Database export failed:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        },
        status: 500
      }
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/save-db-tables' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{}'

*/
