#!/bin/bash

# Test script for the database export Edge Function
# This script tests the function locally and in production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧪 Testing Database Export Edge Function${NC}"
echo "================================================"

# Check if we're in local or production mode
if [ "$1" = "local" ]; then
    echo -e "${YELLOW}🏠 Testing locally...${NC}"
    URL="http://127.0.0.1:54321/functions/v1/save-db-tables"
    KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
else
    echo -e "${YELLOW}🌐 Testing production...${NC}"
    
    # Try to load from .env.local first, then .env.production
    if [ -f ".env.local" ]; then
        echo "📄 Loading environment from .env.local"
        # Load environment variables, handling comments and empty lines
        while IFS= read -r line; do
            # Skip comments and empty lines
            if [[ ! "$line" =~ ^[[:space:]]*# ]] && [[ -n "$line" ]]; then
                export "$line"
            fi
        done < .env.local
    elif [ -f ".env.production" ]; then
        echo "📄 Loading environment from .env.production"
        # Load environment variables, handling comments and empty lines
        while IFS= read -r line; do
            # Skip comments and empty lines
            if [[ ! "$line" =~ ^[[:space:]]*# ]] && [[ -n "$line" ]]; then
                export "$line"
            fi
        done < .env.production
    fi
    
    # Check for required environment variables
    if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
        echo -e "${RED}❌ Missing required environment variables${NC}"
        echo "Required:"
        echo "  - NEXT_PUBLIC_SUPABASE_URL"
        echo "  - NEXT_PUBLIC_SUPABASE_ANON_KEY"
        echo ""
        echo "Please ensure these are set in your .env.local or .env.production file"
        echo "Or set them manually:"
        echo "  export NEXT_PUBLIC_SUPABASE_URL='https://your-project.supabase.co'"
        echo "  export NEXT_PUBLIC_SUPABASE_ANON_KEY='your-anon-key'"
        exit 1
    fi
    
    URL="$NEXT_PUBLIC_SUPABASE_URL/functions/v1/save-db-tables"
    KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY"
fi

echo "URL: $URL"
echo "Key: ${KEY:0:20}..."

# Test the function
echo -e "${YELLOW}📡 Calling Edge Function...${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" \
    --location --request POST "$URL" \
    --header "Authorization: Bearer $KEY" \
    --header "Content-Type: application/json" \
    --data '{}')

# Split response and status code
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"

# Check if successful
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Function executed successfully!${NC}"
    
    # Extract export folder from response
    EXPORT_FOLDER=$(echo "$BODY" | jq -r '.exportFolder' 2>/dev/null)
    if [ "$EXPORT_FOLDER" != "null" ] && [ -n "$EXPORT_FOLDER" ]; then
        echo -e "${GREEN}📁 Export folder: $EXPORT_FOLDER${NC}"
        echo -e "${YELLOW}💡 Check your Supabase Storage bucket 'db_exports' for the exported files${NC}"
    fi
else
    echo -e "${RED}❌ Function failed with status $HTTP_CODE${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 Test completed successfully!${NC}"
