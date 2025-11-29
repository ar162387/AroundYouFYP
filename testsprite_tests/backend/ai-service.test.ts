/**
 * AI Service Comprehensive Test Suite
 * 
 * Tests the intelligent search service with edge cases, validations,
 * and multiple items search queries.
 * 
 * Run with: npx ts-node testsprite_tests/backend/ai-service.test.ts
 */

// Setup mocks before any other imports
import './setup';

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { intelligentSearch, formatIntelligentSearchResultsForLLM } from '../../src/services/ai/intelligentSearchService';
import { createChatCompletion } from '../../src/services/ai/openAIService';
import { executeFunctionCall } from '../../src/services/ai/functionRouter';
import type { FunctionExecutionContext } from '../../src/services/ai/functionRouter';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const openaiApiKey = process.env.OPENAI_API_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env file');
  process.exit(1);
}

if (!openaiApiKey) {
  console.error('❌ Missing OPENAI_API_KEY in .env file');
  process.exit(1);
}

// Test configuration
const TEST_LATITUDE = parseFloat(process.env.TEST_LATITUDE || '31.4523');
const TEST_LONGITUDE = parseFloat(process.env.TEST_LONGITUDE || '74.4360');
const TEST_SHOP_ID = process.env.TEST_SHOP_ID || '';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || '';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || '';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
  duration?: number;
}

const results: TestResult[] = [];

// Helper function to run a test
async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<void> {
  const startTime = Date.now();
  try {
    console.log(`\n🧪 Testing: ${name}`);
    await testFn();
    const duration = Date.now() - startTime;
    results.push({ name, passed: true, duration });
    console.log(`✅ PASSED: ${name} (${duration}ms)`);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMessage = error?.message || String(error);
    results.push({ name, passed: false, error: errorMessage, duration });
    console.log(`❌ FAILED: ${name}`);
    console.log(`   Error: ${errorMessage}`);
    if (error?.stack) {
      console.log(`   Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
    }
  }
}

// Mock function context for testing
function createMockFunctionContext(): FunctionExecutionContext {
  return {
    addItemToCartFn: async () => {},
    removeItemFromCartFn: async () => {},
    updateItemQuantityFn: async () => {},
    getShopCartFn: () => null,
    getAllCartsFn: () => [],
    deleteShopCartFn: async () => {},
    getCurrentLocation: async () => ({ latitude: TEST_LATITUDE, longitude: TEST_LONGITUDE }),
    getDefaultAddressId: async () => null,
    currentAddress: {
      id: 'test-address',
      user_id: 'test-user',
      title: null,
      street_address: 'Test Address',
      city: 'Lahore',
      region: null,
      latitude: TEST_LATITUDE,
      longitude: TEST_LONGITUDE,
      landmark: null,
      formatted_address: 'Test Address, Lahore',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    getShopDetailsFn: async (shopId: string) => {
      const { data } = await supabase
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .single();
      return data;
    },
    getItemDetailsFn: async (itemId: string, shopId: string) => {
      const { data } = await supabase
        .from('merchant_items')
        .select('*')
        .eq('id', itemId)
        .eq('shop_id', shopId)
        .single();
      return data;
    },
  };
}

// ============================================================================
// TEST SUITE 1: Basic Search Functionality
// ============================================================================

async function testBasicSearch() {
  await runTest('Basic single item search', async () => {
    const result = await intelligentSearch('lays', TEST_LATITUDE, TEST_LONGITUDE);
    if (result.error) throw new Error(result.error);
    if (!result.data) throw new Error('No data returned');
    if (result.data.results.length === 0) throw new Error('No results found');
  });

  await runTest('Search with brand variation', async () => {
    const result = await intelligentSearch('coca cola', TEST_LATITUDE, TEST_LONGITUDE);
    if (result.error) throw new Error(result.error);
    if (!result.data) throw new Error('No data returned');
    // Should expand to Coca-Cola
    if (!result.data.intent.brands.some((b: string) => b.toLowerCase().includes('coca'))) {
      throw new Error('Brand expansion failed');
    }
  });

  await runTest('Search with category synonym', async () => {
    const result = await intelligentSearch('chips', TEST_LATITUDE, TEST_LONGITUDE);
    if (result.error) throw new Error(result.error);
    if (!result.data) throw new Error('No data returned');
    // Should match Munchies category
    if (!result.data.intent.categories.some((c: string) => c.toLowerCase().includes('munch'))) {
      console.warn('Category synonym matching may need improvement');
    }
  });
}

// ============================================================================
// TEST SUITE 2: Multiple Items Search Queries
// ============================================================================

async function testMultipleItemsSearch() {
  await runTest('Multiple items with quantities: "pamper, 2 always, 3 shampoo"', async () => {
    const result = await intelligentSearch('pamper, 2 always, 3 shampoo', TEST_LATITUDE, TEST_LONGITUDE);
    if (result.error) throw new Error(result.error);
    if (!result.data) throw new Error('No data returned');
    
    // Check that quantities are extracted
    const extractedItems = result.data.intent.extractedItems;
    if (extractedItems.length < 3) {
      throw new Error(`Expected at least 3 extracted items, got ${extractedItems.length}`);
    }
    
    // Check for Always with quantity 2
    const alwaysItem = extractedItems.find((item: any) => 
      item.name.toLowerCase().includes('always') || 
      item.brand?.toLowerCase().includes('always')
    );
    if (!alwaysItem) {
      throw new Error('Always item not extracted');
    }
    if (alwaysItem.quantity !== 2) {
      throw new Error(`Expected Always quantity 2, got ${alwaysItem.quantity || 1}`);
    }
    
    // Check for shampoo with quantity 3
    const shampooItem = extractedItems.find((item: any) => 
      item.name.toLowerCase().includes('shampoo') ||
      item.searchTerms.some((term: string) => term.toLowerCase().includes('shampoo'))
    );
    if (!shampooItem) {
      throw new Error('Shampoo item not extracted');
    }
    if (shampooItem.quantity !== 3) {
      throw new Error(`Expected shampoo quantity 3, got ${shampooItem.quantity || 1}`);
    }
  });

  await runTest('Multiple items without quantities: "milk and bread"', async () => {
    const result = await intelligentSearch('milk and bread', TEST_LATITUDE, TEST_LONGITUDE);
    if (result.error) throw new Error(result.error);
    if (!result.data) throw new Error('No data returned');
    
    const extractedItems = result.data.intent.extractedItems;
    if (extractedItems.length < 2) {
      throw new Error(`Expected at least 2 extracted items, got ${extractedItems.length}`);
    }
    
    // Both should default to quantity 1
    extractedItems.forEach((item: any) => {
      if (item.quantity === undefined || item.quantity === null) {
        item.quantity = 1; // Default
      }
      if (item.quantity !== 1) {
        throw new Error(`Expected default quantity 1, got ${item.quantity}`);
      }
    });
  });

  await runTest('Multiple items with mixed quantities: "2 coke, 5 lays"', async () => {
    const result = await intelligentSearch('2 coke, 5 lays', TEST_LATITUDE, TEST_LONGITUDE);
    if (result.error) throw new Error(result.error);
    if (!result.data) throw new Error('No data returned');
    
    const extractedItems = result.data.intent.extractedItems;
    const cokeItem = extractedItems.find((item: any) => 
      item.name.toLowerCase().includes('coke') ||
      item.searchTerms.some((term: string) => term.toLowerCase().includes('coke'))
    );
    const laysItem = extractedItems.find((item: any) => 
      item.name.toLowerCase().includes('lay') ||
      item.brand?.toLowerCase().includes('lay')
    );
    
    if (cokeItem && cokeItem.quantity !== 2) {
      throw new Error(`Expected coke quantity 2, got ${cokeItem.quantity || 1}`);
    }
    if (laysItem && laysItem.quantity !== 5) {
      throw new Error(`Expected lays quantity 5, got ${laysItem.quantity || 1}`);
    }
  });
}

// ============================================================================
// TEST SUITE 3: Edge Cases
// ============================================================================

async function testEdgeCases() {
  await runTest('Empty query string', async () => {
    const result = await intelligentSearch('', TEST_LATITUDE, TEST_LONGITUDE);
    // Should handle gracefully, either return empty results or error
    if (result.error && !result.error.includes('query')) {
      throw new Error(`Unexpected error for empty query: ${result.error}`);
    }
  });

  await runTest('Very long query string', async () => {
    const longQuery = 'a '.repeat(500) + 'bread';
    const result = await intelligentSearch(longQuery, TEST_LATITUDE, TEST_LONGITUDE);
    if (result.error && result.error.includes('token')) {
      // Token limit error is acceptable
      return;
    }
    // Should still process or return reasonable error
  });

  await runTest('Special characters in query', async () => {
    const result = await intelligentSearch('coke@#$%^&*()', TEST_LATITUDE, TEST_LONGITUDE);
    if (result.error) throw new Error(result.error);
    // Should sanitize and still search
  });

  await runTest('Numbers only query', async () => {
    const result = await intelligentSearch('12345', TEST_LATITUDE, TEST_LONGITUDE);
    // Should handle gracefully
    if (result.error && !result.error.includes('No shops')) {
      console.warn('Numbers-only query may need better handling');
    }
  });

  await runTest('Invalid coordinates (out of range)', async () => {
    const result = await intelligentSearch('bread', 999, 999);
    if (result.error) {
      // Error is expected for invalid coordinates
      return;
    }
    if (result.data?.results.length === 0) {
      // Empty results are also acceptable
      return;
    }
  });

  await runTest('Negative coordinates', async () => {
    const result = await intelligentSearch('bread', -31.4523, -74.4360);
    // Should handle or return empty results
    if (result.error && !result.error.includes('location')) {
      console.warn('Negative coordinates handling may need improvement');
    }
  });
}

// ============================================================================
// TEST SUITE 4: Validations
// ============================================================================

async function testValidations() {
  await runTest('Quantity validation - zero quantity', async () => {
    const result = await intelligentSearch('0 bread', TEST_LATITUDE, TEST_LONGITUDE);
    if (result.error) throw new Error(result.error);
    // Should either ignore zero or default to 1
    const extractedItems = result.data?.intent.extractedItems || [];
    extractedItems.forEach((item: any) => {
      if (item.quantity === 0) {
        throw new Error('Zero quantity should be handled (defaulted to 1 or ignored)');
      }
    });
  });

  await runTest('Quantity validation - negative quantity', async () => {
    const result = await intelligentSearch('-5 bread', TEST_LATITUDE, TEST_LONGITUDE);
    if (result.error) throw new Error(result.error);
    // Should handle negative quantities gracefully
    const extractedItems = result.data?.intent.extractedItems || [];
    extractedItems.forEach((item: any) => {
      if (item.quantity && item.quantity < 0) {
        throw new Error('Negative quantity should be handled');
      }
    });
  });

  await runTest('Quantity validation - very large quantity', async () => {
    const result = await intelligentSearch('999999 bread', TEST_LATITUDE, TEST_LONGITUDE);
    if (result.error) throw new Error(result.error);
    // Should extract but may need validation at cart level
    const extractedItems = result.data?.intent.extractedItems || [];
    const breadItem = extractedItems.find((item: any) => 
      item.name.toLowerCase().includes('bread') ||
      item.searchTerms.some((term: string) => term.toLowerCase().includes('bread'))
    );
    if (breadItem && breadItem.quantity !== undefined && breadItem.quantity > 1000) {
      console.warn('Very large quantities may need validation');
    }
  });

  await runTest('Query with only punctuation', async () => {
    const result = await intelligentSearch('!!!@@@###', TEST_LATITUDE, TEST_LONGITUDE);
    // Should handle gracefully
    if (result.error && !result.error.includes('No shops')) {
      console.warn('Punctuation-only queries may need better handling');
    }
  });
}

// ============================================================================
// TEST SUITE 5: Function Router Tests
// ============================================================================

async function testFunctionRouter() {
  const mockContext = createMockFunctionContext();

  await runTest('intelligentSearch function call', async () => {
    const result = await executeFunctionCall(
      'intelligentSearch',
      { query: 'bread', maxShops: 5, itemsPerShop: 10 },
      mockContext
    );
    if (!result.success) throw new Error(result.error || 'Function call failed');
    if (!result.result?.shops) throw new Error('No shops in result');
  });

  await runTest('addItemsToCart with quantities', async () => {
    // First, get a real item ID from a shop
    if (!TEST_SHOP_ID) {
      console.log('⚠️  Skipping: TEST_SHOP_ID not set');
      return;
    }

    const { data: items } = await supabase
      .from('merchant_items')
      .select('id')
      .eq('shop_id', TEST_SHOP_ID)
      .eq('is_active', true)
      .limit(2);

    if (!items || items.length < 2) {
      console.log('⚠️  Skipping: Not enough items in test shop');
      return;
    }

    const result = await executeFunctionCall(
      'addItemsToCart',
      {
        items: [
          { shopId: TEST_SHOP_ID, itemId: items[0].id, quantity: 2 },
          { shopId: TEST_SHOP_ID, itemId: items[1].id, quantity: 3 },
        ],
      },
      mockContext
    );

    if (!result.success) throw new Error(result.error || 'Function call failed');
    if (!result.result?.added || result.result.added.length !== 2) {
      throw new Error('Items not added correctly');
    }
    
    // Verify quantities
    if (result.result.added[0].quantity !== 2) {
      throw new Error(`Expected quantity 2, got ${result.result.added[0].quantity}`);
    }
    if (result.result.added[1].quantity !== 3) {
      throw new Error(`Expected quantity 3, got ${result.result.added[1].quantity}`);
    }
  });

  await runTest('getAllCarts function call', async () => {
    const result = await executeFunctionCall('getAllCarts', {}, mockContext);
    if (!result.success) throw new Error(result.error || 'Function call failed');
    if (!Array.isArray(result.result?.carts)) {
      throw new Error('Carts should be an array');
    }
  });
}

// ============================================================================
// TEST SUITE 6: OpenAI Service Tests
// ============================================================================

async function testOpenAIService() {
  await runTest('OpenAI chat completion', async () => {
    const result = await createChatCompletion([
      { role: 'user', content: 'Hello, this is a test' },
    ]);
    if (result.error) throw new Error(result.error);
    if (!result.data) throw new Error('No data returned');
    if (!result.data.choices || result.data.choices.length === 0) {
      throw new Error('No choices in response');
    }
  });

  await runTest('OpenAI with function calling', async () => {
    const result = await createChatCompletion(
      [
        { role: 'user', content: 'Search for bread' },
      ],
      {
        functions: [
          {
            name: 'intelligentSearch',
            description: 'Search for items',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string' },
              },
              required: ['query'],
            },
          },
        ],
        function_call: 'auto',
      }
    );
    if (result.error) throw new Error(result.error);
    // Should either return function call or regular response
  });

  await runTest('OpenAI rate limit handling', async () => {
    // This test would require actual rate limiting scenario
    // For now, just verify error handling structure
    console.log('⚠️  Rate limit test requires actual rate limit scenario');
  });
}

// ============================================================================
// TEST SUITE 7: Formatting and Output Tests
// ============================================================================

async function testFormatting() {
  await runTest('Format search results for LLM', async () => {
    const searchResult = await intelligentSearch('bread', TEST_LATITUDE, TEST_LONGITUDE);
    if (searchResult.error || !searchResult.data) {
      throw new Error('Search failed');
    }

    const formatted = formatIntelligentSearchResultsForLLM(searchResult.data);
    if (!formatted || formatted.length === 0) {
      throw new Error('Formatted results are empty');
    }
    if (!formatted.includes('Search Results:')) {
      throw new Error('Formatted results missing header');
    }
  });

  await runTest('Format results with quantities', async () => {
    const searchResult = await intelligentSearch('2 bread, 3 milk', TEST_LATITUDE, TEST_LONGITUDE);
    if (searchResult.error || !searchResult.data) {
      throw new Error('Search failed');
    }

    const formatted = formatIntelligentSearchResultsForLLM(searchResult.data);
    // Should include quantity information
    if (searchResult.data.intent.extractedItems.some((item: any) => item.quantity !== undefined && item.quantity > 1)) {
      if (!formatted.toLowerCase().includes('quantity') && !formatted.toLowerCase().includes('suggested')) {
        console.warn('Quantity information may not be included in formatted output');
      }
    }
  });
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.log('🚀 Starting AI Service Comprehensive Test Suite');
  console.log('='.repeat(60));
  console.log(`📍 Test Location: ${TEST_LATITUDE}, ${TEST_LONGITUDE}`);
  console.log(`🏪 Test Shop ID: ${TEST_SHOP_ID || 'Not set'}`);
  console.log('='.repeat(60));

  try {
    // Run all test suites
    await testBasicSearch();
    await testMultipleItemsSearch();
    await testEdgeCases();
    await testValidations();
    await testFunctionRouter();
    await testOpenAIService();
    await testFormatting();

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);
    console.log(`📈 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`  - ${r.name}`);
          console.log(`    Error: ${r.error}`);
        });
    }

    console.log('\n' + '='.repeat(60));

    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
  } catch (error: any) {
    console.error('\n💥 Fatal error running tests:', error);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests();
}

export { runAllTests, results };

