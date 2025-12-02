/**
 * Test Vector Search with Real Query Embeddings
 * 
 * Tests vector search with actual OpenAI embeddings to diagnose why it returns 0 results.
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
  console.error('Error: Required environment variables must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

async function testVectorSearch() {
  console.log('=== VECTOR SEARCH TEST ===\n');
  
  try {
    // Test queries that should match items in the database
    const testQueries = ['Oreo mini', 'Capstan', 'Dunhill'];
    
    // Get shop IDs
    const { data: shops, error: shopError } = await supabase
      .from('shops')
      .select('id, name')
      .eq('is_open', true)
      .limit(5);
    
    if (shopError || !shops || shops.length === 0) {
      console.error('❌ No shops found');
      return;
    }
    
    const shopIds = shops.map(s => s.id);
    console.log(`Testing with ${shops.length} shops:`);
    shops.forEach((s, i) => console.log(`  ${i + 1}. ${s.name} (${s.id.substring(0, 8)}...)`));
    console.log('');
    
    for (const query of testQueries) {
      console.log(`\n=== Testing query: "${query}" ===`);
      
      // 1. Generate embedding for query
      console.log('1. Generating query embedding...');
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
      });
      
      const queryEmbedding = embeddingResponse.data[0].embedding;
      console.log(`   ✅ Generated embedding with ${queryEmbedding.length} dimensions`);
      console.log(`   First 5 values: [${queryEmbedding.slice(0, 5).map(v => v.toFixed(6)).join(', ')}]`);
      
      // 2. Call vector search function
      console.log('\n2. Calling vector search function...');
      const { data: results, error: searchError } = await supabase.rpc(
        'search_items_across_shops_by_similarity',
        {
          p_shop_ids: shopIds,
          p_query_embedding: queryEmbedding,
          p_limit: 10,
          p_min_similarity: 0.5,
        }
      );
      
      if (searchError) {
        console.error('   ❌ Search error:', searchError.message);
        console.error('      Code:', searchError.code);
        console.error('      Details:', searchError.details);
        console.error('      Hint:', searchError.hint);
        continue;
      }
      
      console.log(`   ✅ Search succeeded`);
      console.log(`   📊 Results: ${results?.length || 0} items found`);
      
      if (results && results.length > 0) {
        console.log('\n3. Top results:');
        results.slice(0, 5).forEach((item: any, idx: number) => {
          console.log(`   ${idx + 1}. ${item.item_name}`);
          console.log(`      Shop: ${item.shop_name}`);
          console.log(`      Similarity: ${(item.similarity * 100).toFixed(1)}%`);
          console.log(`      Price: PKR ${(item.price_cents / 100).toFixed(2)}`);
        });
      } else {
        console.log('\n⚠️  No results returned!');
        console.log('   Possible reasons:');
        console.log('   1. Similarity scores are all below 0.5 threshold');
        console.log('   2. Items are not active (is_active = false)');
        console.log('   3. Shops are not open (is_open = false)');
        console.log('   4. Query embedding doesn\'t match any item embeddings');
      }
      
      // 3. Try with lower similarity threshold
      if (!results || results.length === 0) {
        console.log('\n4. Retrying with lower similarity threshold (0.3)...');
        const { data: results2, error: searchError2 } = await supabase.rpc(
          'search_items_across_shops_by_similarity',
          {
            p_shop_ids: shopIds,
            p_query_embedding: queryEmbedding,
            p_limit: 10,
            p_min_similarity: 0.3,
          }
        );
        
        if (searchError2) {
          console.error('   ❌ Search error:', searchError2.message);
        } else {
          console.log(`   📊 Results with 0.3 threshold: ${results2?.length || 0} items found`);
          if (results2 && results2.length > 0) {
            results2.slice(0, 3).forEach((item: any, idx: number) => {
              console.log(`   ${idx + 1}. ${item.item_name} - ${(item.similarity * 100).toFixed(1)}% similarity`);
            });
          }
        }
      }
      
      // 4. Check if items exist in the shops being searched
      console.log('\n5. Checking if matching items exist in searched shops...');
      const { data: matchingItems, error: itemError } = await supabase
        .from('merchant_items')
        .select('id, name, shop_id, is_active')
        .ilike('name', `%${query}%`)
        .in('shop_id', shopIds)
        .limit(5);
      
      if (itemError) {
        console.error('   ❌ Error:', itemError.message);
      } else if (!matchingItems || matchingItems.length === 0) {
        console.log('   ⚠️  No items found in these shops that match the query name');
      } else {
        console.log(`   ✅ Found ${matchingItems.length} item(s) matching "${query}" in searched shops:`);
        matchingItems.forEach((item: any, idx: number) => {
          console.log(`      ${idx + 1}. ${item.name} (Active: ${item.is_active})`);
        });
      }
    }
    
    console.log('\n=== TEST COMPLETE ===');
    
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testVectorSearch();

