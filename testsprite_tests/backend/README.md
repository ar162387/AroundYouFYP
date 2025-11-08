# Backend API Tests for Delivery Logic

This directory contains backend API tests for the delivery logic tiering and pricing functionality.

## Prerequisites

1. **Node.js and TypeScript**: Ensure you have Node.js installed and can run TypeScript files
2. **Environment Variables**: Create a `.env` file in the project root with:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   TEST_SHOP_ID=your_test_shop_id
   TEST_USER_EMAIL=test_merchant@example.com
   TEST_USER_PASSWORD=test_password
   ```

3. **Test Data**: 
   - You need a test shop ID that exists in your database
   - You need a test merchant user account for RLS policy testing

## Installation

Install required dependencies:

```bash
npm install --save-dev ts-node @types/node dotenv
# or
yarn add -D ts-node @types/node dotenv
```

## Running Tests

### Run All Tests

```bash
cd testsprite_tests/backend
./run-tests.sh  # Runs API tests
npx ts-node delivery-tiering-calculation.test.ts  # Runs tiering calculation tests
```

### Option 1: API Tests

```bash
npx ts-node testsprite_tests/backend/delivery-logic-api.test.ts
```

### Option 2: Tiering Calculation Tests

```bash
npx ts-node testsprite_tests/backend/delivery-tiering-calculation.test.ts
```

### Option 3: Add to package.json

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "test:delivery-logic-api": "ts-node testsprite_tests/backend/delivery-logic-api.test.ts",
    "test:delivery-tiering": "ts-node testsprite_tests/backend/delivery-tiering-calculation.test.ts",
    "test:delivery-all": "npm run test:delivery-logic-api && npm run test:delivery-tiering"
  }
}
```

Then run:
```bash
npm run test:delivery-logic-api    # API tests
npm run test:delivery-tiering      # Tiering calculation tests
npm run test:delivery-all          # All delivery tests
```

## Test Suites

### 1. API Tests (`delivery-logic-api.test.ts`)
Tests the Supabase backend API endpoints and database operations.

### 2. Tiering Calculation Tests (`delivery-tiering-calculation.test.ts`)
Tests the business logic functions that calculate delivery fees based on distance tiers, order values, and free delivery rules.

## Test Coverage

### API Tests (`delivery-logic-api.test.ts`)
The test suite covers:

### 1. CRUD Operations
- ✅ Create delivery logic with all fields
- ✅ Fetch delivery logic by shop_id
- ✅ Update delivery logic fields
- ✅ Update distance mode (auto ↔ custom)

### 2. Database Constraints
- ✅ `max_delivery_fee > 0` constraint
- ✅ `distance_mode IN ('auto', 'custom')` constraint
- ✅ `beyond_tier_distance_unit > 0` constraint

### 3. JSONB Distance Tiers
- ✅ Store custom distance tiers as JSONB
- ✅ Retrieve and validate tier structure
- ✅ Update tiers with different configurations

### 4. Default Values
- ✅ Verify default values are applied when fields are omitted:
  - `distance_mode`: 'auto'
  - `max_delivery_fee`: 130
  - `beyond_tier_fee_per_unit`: 10
  - `beyond_tier_distance_unit`: 250
  - `free_delivery_threshold`: 800
  - `free_delivery_radius`: 1000
  - `distance_tiers`: Default 5 tiers

### 5. RLS Policies
- ✅ Test Row Level Security policies
- ✅ Verify users can only access their own shop's delivery logic

### 6. Edge Cases
- ✅ Very large numeric values
- ✅ Decimal values (precision handling)
- ✅ Empty arrays

### Tiering Calculation Tests (`delivery-tiering-calculation.test.ts`)
The test suite covers:

### 1. Distance Calculation (Haversine Formula)
- ✅ Same location (0 distance)
- ✅ Small distances
- ✅ Larger distances

### 2. Delivery Fee Calculation
- ✅ Fees within each tier (200m, 400m, 600m, 800m, 1000m)
- ✅ Fees at tier boundaries
- ✅ Fees beyond last tier (linear scaling)
- ✅ Maximum delivery fee cap enforcement

### 3. Custom Tiers
- ✅ Custom tier configurations
- ✅ Fees for custom tier distances
- ✅ Beyond custom tiers calculation

### 4. Free Delivery Logic
- ✅ Qualifies when order value >= threshold AND distance <= radius
- ✅ Rejects when order value too low
- ✅ Rejects when distance too far
- ✅ Boundary conditions

### 5. Order Value Surcharge
- ✅ Surcharge applied when order < minimum
- ✅ No surcharge when order >= minimum

### 6. Order Value Validation
- ✅ Rejects orders below least order value
- ✅ Accepts orders at or above least order value

### 7. Total Delivery Fee (All Layers Combined)
- ✅ Free delivery applied correctly
- ✅ Base fee + surcharge calculation
- ✅ Maximum cap enforcement

### 8. Edge Cases
- ✅ Zero distance
- ✅ Very small distances
- ✅ Unordered tiers (function should sort)

## Expected Output

```
🚀 Starting Backend API Tests for Delivery Logic

Supabase URL: https://your-project.supabase.co
Test Shop ID: abc123...

=== Test: Create Delivery Logic ===
✅ PASS: Create Delivery Logic

=== Test: Fetch Delivery Logic ===
✅ PASS: Fetch Delivery Logic

...

============================================================
📊 TEST SUMMARY
============================================================
Total Tests: 15
✅ Passed: 14
❌ Failed: 1
Success Rate: 93.3%
============================================================
```

## Troubleshooting

### Error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY"
- Ensure your `.env` file exists in the project root
- Verify the environment variables are set correctly

### Error: "TEST_SHOP_ID not set"
- Add a valid shop ID to your `.env` file
- The shop must exist in your `shops` table

### Error: "RLS Policies - Authentication failed"
- Ensure `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` are correct
- The user must be a merchant with access to the test shop

### Error: "Constraint violation"
- This is expected for constraint tests
- The test verifies that invalid data is rejected

## Notes

- Tests may modify data in your database. Use a test/demo environment if possible.
- Some tests require cleanup (e.g., default values test creates a temporary record).
- RLS policy tests require an authenticated user session.

## Extending Tests

To add more tests:

1. Create a new async function following the pattern:
```typescript
async function testNewFeature() {
  console.log('\n=== Test: New Feature ===');
  // Your test code here
  logTest('Test Name', passed, error, details);
}
```

2. Call it in the `runTests()` function:
```typescript
await testNewFeature();
```

3. Use the `logTest()` helper to record results:
```typescript
logTest('Test Name', passed, errorMessage, detailsObject);
```

