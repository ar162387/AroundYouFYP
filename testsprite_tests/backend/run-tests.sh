#!/bin/bash

# Backend API Test Runner for Delivery Logic
# This script helps run the backend tests with proper setup

echo "🧪 Backend API Tests - Delivery Logic"
echo "======================================"
echo ""

# Check if .env file exists
if [ ! -f "../../.env" ]; then
    echo "❌ Error: .env file not found in project root"
    echo "   Please create .env file with:"
    echo "   - SUPABASE_URL"
    echo "   - SUPABASE_ANON_KEY"
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
    npm install --save-dev ts-node @types/node dotenv
fi

echo "🚀 Running tests..."
echo ""

# Run the tests
npx ts-node delivery-logic-api.test.ts

exit_code=$?

echo ""
if [ $exit_code -eq 0 ]; then
    echo "✅ All tests passed!"
else
    echo "❌ Some tests failed. Check the output above."
fi

exit $exit_code

