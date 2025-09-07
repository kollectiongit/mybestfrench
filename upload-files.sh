#!/bin/bash

# Script to upload files from public/files_to_upload to Supabase buckets
# Usage: ./upload-files.sh

echo "🚀 Starting file upload process..."

# Check if the API endpoint is available
echo "📡 Checking API endpoint..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/upload-files)

if [ "$response" != "200" ]; then
    echo "❌ API endpoint not available. Make sure your Next.js server is running on localhost:3000"
    echo "   Run: npm run dev"
    exit 1
fi

echo "✅ API endpoint is available"

# Check files to upload
echo "📁 Checking files to upload..."
files_response=$(curl -s http://localhost:3000/api/upload-files)
total_files=$(echo $files_response | grep -o '"totalFiles":[0-9]*' | grep -o '[0-9]*')

if [ "$total_files" = "0" ]; then
    echo "ℹ️  No files found to upload in public/files_to_upload/"
    exit 0
fi

echo "📋 Found $total_files files to upload"

# Upload files
echo "⬆️  Uploading files to Supabase..."
upload_response=$(curl -s -X POST http://localhost:3000/api/upload-files)

# Parse the response to show results
echo "$upload_response" | grep -o '"message":"[^"]*"' | sed 's/"message":"//' | sed 's/"//'
echo "$upload_response" | grep -o '"uploaded":[0-9]*' | sed 's/"uploaded"://' | while read uploaded; do
    echo "   Audio files uploaded: $uploaded"
done
echo "$upload_response" | grep -o '"uploaded":[0-9]*' | sed 's/"uploaded"://' | tail -1 | while read uploaded; do
    echo "   Image files uploaded: $uploaded"
done

echo "✅ Upload process completed!"
echo ""
echo "📂 Files have been moved to:"
echo "   - public/files_uploaded/audio/"
echo "   - public/files_uploaded/images/"
echo ""
echo "☁️  Files are now available in Supabase buckets:"
echo "   - audio bucket"
echo "   - images bucket"
