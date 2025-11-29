# AI Service Comprehensive Test Suite

This test suite thoroughly tests the AI service functionality including intelligent search, quantity extraction, edge cases, and validations.

## Prerequisites

1. **Node.js and TypeScript**: Ensure you have Node.js installed
2. **Environment Variables**: Create a `.env` file in the project root with:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   OPENAI_API_KEY=your_openai_api_key
   TEST_LATITUDE=31.4523  # Optional, default: 31.4523
   TEST_LONGITUDE=74.4360  # Optional, default: 74.4360
   TEST_SHOP_ID=your_test_shop_id  # Optional, for cart tests
   TEST_USER_EMAIL=test_user@example.com  # Optional
   TEST_USER_PASSWORD=test_password  # Optional
   ```

3. **Dependencies**: Install required test dependencies:
   ```bash
   npm install --save-dev ts-node @types/node dotenv @supabase/supabase-js
   ```

## Running Tests

### Option 1: Using npm script (Recommended)
```bash
npm run test:ai-service
```

This uses the proper TypeScript configuration and mocks for React Native modules.

### Option 2: Direct execution
```bash
npx ts-node --project testsprite_tests/backend/tsconfig.json --transpile-only --require ./testsprite_tests/backend/setup.ts testsprite_tests/backend/ai-service.test.ts
```

### Option 3: Using the shell script
```bash
cd testsprite_tests/backend
./run-ai-tests.sh
```

**Note:** Tests make real API calls to OpenAI and Supabase, so they may take several minutes to complete. Some tests may incur API costs.

## Test Coverage

### 1. Basic Search Functionality
- ✅ Single item search
- ✅ Brand variation handling (e.g., "lays" → "Lay's")
- ✅ Category synonym matching (e.g., "chips" → "Munchies")

### 2. Multiple Items Search Queries
- ✅ Multiple items with quantities: "pamper, 2 always, 3 shampoo"
- ✅ Multiple items without quantities: "milk and bread"
- ✅ Mixed quantities: "2 coke, 5 lays"

### 3. Edge Cases
- ✅ Empty query string
- ✅ Very long query string (500+ words)
- ✅ Special characters in query
- ✅ Numbers only query
- ✅ Invalid coordinates (out of range)
- ✅ Negative coordinates

### 4. Validations
- ✅ Zero quantity handling
- ✅ Negative quantity handling
- ✅ Very large quantity handling
- ✅ Punctuation-only queries

### 5. Function Router Tests
- ✅ intelligentSearch function call
- ✅ addItemsToCart with quantities
- ✅ getAllCarts function call

### 6. OpenAI Service Tests
- ✅ Basic chat completion
- ✅ Function calling
- ✅ Rate limit handling structure

### 7. Formatting and Output Tests
- ✅ Format search results for LLM
- ✅ Format results with quantities

## Test Results

After running the tests, you'll see:
- ✅ Passed tests count
- ❌ Failed tests count
- ⏱️ Total duration
- 📈 Success rate percentage
- Detailed error messages for failed tests

## Expected Behavior

### Quantity Extraction
The AI service should correctly extract quantities from queries:
- "2 always" → Always pads, quantity: 2
- "3 shampoo" → Shampoo, quantity: 3
- "pamper" → Pampers, quantity: 1 (default)

### Multiple Items
The service should treat multiple items as separate:
- "pamper, 2 always, 3 shampoo" → 3 separate items with respective quantities
- "milk and bread" → 2 separate items, both quantity 1

### Error Handling
- Empty queries should return graceful errors or empty results
- Invalid coordinates should return errors or empty results
- Missing API keys should return clear error messages

## Troubleshooting

### Common Issues

1. **Missing OPENAI_API_KEY**
   - Error: "Missing OPENAI_API_KEY in .env file"
   - Solution: Add your OpenAI API key to `.env`

2. **No shops found**
   - Error: "No shops found in area"
   - Solution: Adjust TEST_LATITUDE and TEST_LONGITUDE to a location with shops

3. **Rate limiting**
   - Error: "Rate limit exceeded"
   - Solution: Wait a few minutes and retry, or check your OpenAI usage limits

4. **TypeScript errors**
   - Error: Module not found
   - Solution: Run `npm install` to ensure all dependencies are installed

5. **React Native module errors**
   - Error: "window is not defined" or similar
   - Solution: The test setup automatically mocks React Native modules. If you see this error, ensure `setup.ts` is being loaded with `--require` flag

6. **GoTrueClient warnings**
   - Warning: "Multiple GoTrueClient instances detected"
   - Solution: These are harmless warnings and can be ignored. They occur because multiple Supabase clients are created during testing.

## Integration with Other Tests

Run all backend tests together:
```bash
npm run test:all
```

This runs:
1. AI Service tests
2. Delivery Logic API tests
3. Delivery Tiering Calculation tests

## Notes

- Tests make actual API calls to OpenAI and Supabase
- Some tests may incur API costs
- Rate limiting may affect test execution
- Tests require valid API keys and database access
- Some tests are skipped if optional configuration is missing (with warnings)

