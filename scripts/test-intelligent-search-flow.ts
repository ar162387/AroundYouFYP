/**
 * Test Intelligent Search Flow
 * 
 * Tests the complete flow from query → intent → search → results → cart
 * to identify where items are being dropped.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Required environment variables must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSearchFlow() {
  console.log('=== TESTING INTELLIGENT SEARCH FLOW ===\n');
  
  const testQuery = '2 Oreo mini, 3 Rio biscuit, 1 Capstan';
  const shopId = '57e9fd69-517a-4a03-8a7d-818fc6844e3b'; // freshly Askari XI
  
  console.log(`Test Query: "${testQuery}"`);
  console.log(`Shop ID: ${shopId}\n`);
  
  // Step 1: Check if items exist in database
  console.log('STEP 1: Checking if items exist in database...');
  const { data: items, error: itemsError } = await supabase
    .from('merchant_items')
    .select('id, name, shop_id, is_active, price_cents')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .or('name.ilike.%oreo%,name.ilike.%rio%,name.ilike.%capstan%');
  
  if (itemsError) {
    console.error('❌ Error:', itemsError.message);
    return;
  }
  
  console.log(`✅ Found ${items?.length || 0} items:`);
  items?.forEach((item: any) => {
    console.log(`   - ${item.name} (ID: ${item.id.substring(0, 8)}...)`);
  });
  console.log('');
  
  // Step 2: Check embeddings
  console.log('STEP 2: Checking embeddings...');
  if (items && items.length > 0) {
    const itemIds = items.map(i => i.id);
    const { data: embeddings, error: embError } = await supabase
      .from('merchant_item_embeddings')
      .select('merchant_item_id, embedding')
      .in('merchant_item_id', itemIds);
    
    if (embError) {
      console.error('❌ Error:', embError.message);
    } else {
      console.log(`✅ Found ${embeddings?.length || 0} embeddings:`);
      embeddings?.forEach((emb: any) => {
        const item = items.find(i => i.id === emb.merchant_item_id);
        const hasEmbedding = emb.embedding !== null;
        console.log(`   - ${item?.name || 'Unknown'}: ${hasEmbedding ? '✅' : '❌'}`);
      });
    }
  }
  console.log('');
  
  // Step 3: Test vector search for each query
  console.log('STEP 3: Testing vector search queries...');
  const testQueries = ['Oreo mini', 'Rio biscuit', 'Capstan'];
  
  // We'll need OpenAI for embeddings, but let's check what the actual search would return
  // by checking the items directly
  for (const query of testQueries) {
    console.log(`\n   Testing: "${query}"`);
    
    // Check if any items match this query
    const matchingItems = items?.filter((item: any) => 
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      query.toLowerCase().includes(item.name.toLowerCase().split(' ')[0])
    );
    
    if (matchingItems && matchingItems.length > 0) {
      console.log(`   ✅ Found ${matchingItems.length} matching item(s):`);
      matchingItems.forEach((item: any) => {
        console.log(`      - ${item.name}`);
      });
    } else {
      console.log(`   ⚠️  No direct name matches found`);
    }
  }
  console.log('');
  
  // Step 4: Check category search
  console.log('STEP 4: Testing category search...');
  const { data: categories, error: catError } = await supabase
    .from('merchant_categories')
    .select('id, name')
    .in('name', ['Bakery & Biscuits', 'Tobacco', 'Munchies']);
  
  if (catError) {
    console.error('❌ Error:', catError.message);
  } else {
    console.log(`✅ Found ${categories?.length || 0} categories:`);
    categories?.forEach((cat: any) => {
      console.log(`   - ${cat.name} (ID: ${cat.id.substring(0, 8)}...)`);
    });
  }
  console.log('');
  
  // Step 5: Simulate the matching logic
  console.log('STEP 5: Simulating item matching logic...');
  const extractedItems = [
    { name: 'Oreo mini', brand: 'Oreo', category: 'Bakery & Biscuits', quantity: 2 },
    { name: 'Rio biscuit', brand: 'Rio', category: 'Bakery & Biscuits', quantity: 3 },
    { name: 'Capstan', brand: 'Capstan', category: 'Tobacco', quantity: 1 },
  ];
  
  console.log(`Extracted Items (${extractedItems.length}):`);
  extractedItems.forEach((extracted, idx) => {
    console.log(`   ${idx + 1}. ${extracted.name} (${extracted.brand}) - Qty: ${extracted.quantity}`);
    
    // Try to find matching item
    const matched = items?.find((item: any) => {
      const itemNameLower = item.name.toLowerCase();
      const extractedNameLower = extracted.name.toLowerCase();
      const extractedBrandLower = extracted.brand?.toLowerCase() || '';
      
      return itemNameLower.includes(extractedNameLower) ||
             extractedNameLower.includes(itemNameLower.split(' ')[0]) ||
             (extractedBrandLower && itemNameLower.includes(extractedBrandLower));
    });
    
    if (matched) {
      console.log(`      ✅ Matched: ${matched.name}`);
    } else {
      console.log(`      ❌ No match found`);
    }
  });
  
  console.log('\n=== TEST COMPLETE ===');
}

testSearchFlow().catch(console.error);

