#!/bin/bash

# AI Service Test Runner
# This script helps run the AI service tests with proper setup

echo "🧪 AI Service Comprehensive Tests"
echo "=================================="
echo ""

# Check if .env file exists
if [ ! -f "../../.env" ]; then
    echo "❌ Error: .env file not found in project root"
    echo "   Please create .env file with:"
    echo "   - SUPABASE_URL"
    echo "   - SUPABASE_ANON_KEY"
    echo "   - OPENAI_API_KEY"
    echo "   - TEST_LATITUDE (optional, default: 31.4523)"
    echo "   - TEST_LONGITUDE (optional, default: 74.4360)"
    echo "   - TEST_SHOP_ID (optional)"
    echo "   - TEST_USER_EMAIL (optional)"
    echo "   - TEST_USER_PASSWORD (optional)"
    exit 1
fi

# Check if required dependencies are installed
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx not found. Please install Node.js"
    exit 1
fi

# Check if ts-node is available
if ! npx ts-node --version &> /dev/null; then
    echo "📦 Installing required dependencies..."
    npm install --save-dev ts-node @types/node dotenv @supabase/supabase-js
fi

echo "🚀 Running AI service tests..."
echo ""

# Run the tests with proper setup
npx ts-node --project tsconfig.json --transpile-only --require ./setup.ts ai-service.test.ts

exit_code=$?

echo ""
if [ $exit_code -eq 0 ]; then
    echo "✅ All tests passed!"
else
    echo "❌ Some tests failed. Check the output above."
fi

exit $exit_code

