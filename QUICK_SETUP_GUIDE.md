# Quick Setup Guide for Database Export Function

## 🚀 Prerequisites

Before testing the database export function, you need to ensure you have the right environment variables set up.

### Required Environment Variables

Your `.env.local` and `.env.production` files need these variables:

```bash
# Supabase Project URL (get this from your Supabase dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co

# Supabase Anonymous Key (get this from your Supabase dashboard)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## 📋 Steps to Test

### 1. First, deploy the function to Supabase:

```bash
supabase functions deploy save-db-tables
```

### 2. Set up the storage bucket and policies:

Run the SQL script in your Supabase SQL editor:

```sql
-- Copy and paste the contents of supabase/setup-db-export.sql
```

### 3. Test locally (if you have Supabase running locally):

```bash
./supabase/test-db-export.sh local
```

### 4. Test in production:

```bash
./supabase/test-db-export.sh
```

## 🔧 If you get environment variable errors:

The test script will automatically load from your `.env.local` or `.env.production` files, but if you're still getting errors, you can manually set the variables:

```bash
export NEXT_PUBLIC_SUPABASE_URL="https://your-project-id.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
./supabase/test-db-export.sh
```

## 📊 Expected Output

When successful, you should see:

- ✅ Function executed successfully!
- 📁 Export folder: db_exports/2025-01-08T10-30-45
- 💡 Check your Supabase Storage bucket 'db_exports' for the exported files

## 🎯 Next Steps

1. **Deploy**: `supabase functions deploy save-db-tables`
2. **Setup**: Run the setup SQL script in Supabase
3. **Test**: Run the test script
4. **Check**: Look in your Supabase Storage for the exported files
