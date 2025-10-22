# Database Export Edge Function

This Supabase Edge Function exports all tables from the public schema to both CSV and SQL formats and saves them to a Supabase Storage bucket.

## Features

- ✅ Exports all tables from the public schema
- ✅ Generates both CSV and SQL formats for each table
- ✅ Saves files to Supabase Storage bucket with timestamped folders
- ✅ Comprehensive logging throughout the process
- ✅ Handles empty tables gracefully
- ✅ Proper CSV escaping for special characters
- ✅ SQL INSERT statements with proper escaping
- ✅ Error handling for individual tables (continues processing if one fails)

## Setup

### 1. Create the Storage Bucket

First, you need to create a storage bucket called `db_exports` in your Supabase project:

```sql
-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('db_exports', 'db_exports', false);
```

### 2. Apply the Migration

Apply the migration to create the `get_tables()` function:

```bash
supabase db push
```

### 3. Deploy the Edge Function

Deploy the Edge Function to your Supabase project:

```bash
supabase functions deploy save-db-tables
```

## Usage

### Local Development

1. Start Supabase locally:

   ```bash
   supabase start
   ```

2. Invoke the function:
   ```bash
   curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/save-db-tables' \
     --header 'Authorization: Bearer YOUR_ANON_KEY' \
     --header 'Content-Type: application/json' \
     --data '{}'
   ```

### Production

Invoke the function using your production Supabase URL:

```bash
curl -i --location --request POST 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/save-db-tables' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{}'
```

## Output

The function will:

1. Create a timestamped folder in the `db_exports` bucket: `db_exports/YYYY-MM-DD_HH-MM-SS/`
2. Export each table as two files:
   - `table_name.csv` - CSV format with proper escaping
   - `table_name.sql` - SQL INSERT statements
3. Log all actions to the console
4. Return a JSON response with the export details

### Example Response

```json
{
  "success": true,
  "message": "Database export completed successfully",
  "exportFolder": "db_exports/2025-01-08T10-30-45",
  "timestamp": "2025-01-08T10-30-45"
}
```

## File Structure

```
db_exports/
└── 2025-01-08T10-30-45/
    ├── user.csv
    ├── user.sql
    ├── session.csv
    ├── session.sql
    ├── account.csv
    ├── account.sql
    └── ... (all other tables)
```

## CSV Format

- Headers are included in the first row
- Values are properly escaped for CSV format
- Empty values are represented as empty strings
- Special characters are handled correctly

## SQL Format

- Each file contains INSERT statements for all rows
- Values are properly escaped for SQL
- NULL values are represented as `NULL`
- JSON objects are serialized as strings
- Comments include table name and generation timestamp

## Error Handling

- If a table cannot be accessed, it's skipped and processing continues
- Individual table errors are logged but don't stop the entire process
- The function returns appropriate HTTP status codes
- Detailed error messages are provided in the response

## Security

- Uses service role key for database access
- Storage bucket is private by default
- Function requires proper authentication
- SQL injection protection through proper escaping

## Monitoring

All actions are logged to the console with emojis for easy identification:

- 🚀 Process start
- ✅ Success indicators
- ⚠️ Warnings
- ❌ Errors
- 📋 Table discovery
- 📊 Data processing
- 📤 File uploads
- 🎉 Completion

Check your Supabase function logs to monitor the export process.
