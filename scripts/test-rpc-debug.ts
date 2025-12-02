/**
 * Debug RPC Function
 * 
 * Tests the RPC function with detailed debugging to see why it returns 0 results.
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import path from 'path';

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

async function debugRPC() {
  console.log('=== DEBUGGING RPC FUNCTION ===\n');
  
  const shopId = '57e9fd69-517a-4a03-8a7d-818fc6844e3b';
  
  // Step 1: Check how many embeddings exist for this shop
  console.log('1. Checking embeddings in database...');
  const { data: embeddings, error: embError } = await supabase
    .from('merchant_item_embeddings')
    .select('merchant_item_id, embedding')
    .eq('shop_id', shopId);
  
  if (embError) {
    console.error('❌ Error:', embError.message);
    return;
  }
  
  console.log(`   ✅ Found ${embeddings?.length || 0} embeddings`);
  console.log('');
  
  // Step 2: Generate a query embedding
  console.log('2. Generating query embedding...');
  const query = 'Oreo mini';
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });
  
  const queryEmbedding = embeddingResponse.data[0].embedding;
  console.log(`   ✅ Generated: ${queryEmbedding.length} dimensions`);
  console.log(`   First 3 values: [${queryEmbedding.slice(0, 3).join(', ')}]`);
  console.log('');
  
  // Step 3: Test RPC with different parameter formats
  console.log('3. Testing RPC with array parameter...');
  
  // Test A: Direct array
  console.log('   Test A: Direct array parameter');
  const { data: resultsA, error: errorA } = await supabase.rpc(
    'search_items_across_shops_by_similarity',
    {
      p_shop_ids: [shopId],
      p_query_embedding: queryEmbedding,
      p_limit: 10,
      p_min_similarity: 0.0, // Very low to get any result
    }
  );
  
  if (errorA) {
    console.error('      ❌ Error:', errorA.message);
    console.error('         Code:', errorA.code);
    console.error('         Details:', errorA.details);
    console.error('         Hint:', errorA.hint);
  } else {
    console.log(`      ✅ Success: ${resultsA?.length || 0} results`);
    if (resultsA && resultsA.length > 0) {
      resultsA.slice(0, 3).forEach((item: any, idx: number) => {
        console.log(`         ${idx + 1}. ${item.item_name} - ${(item.similarity * 100).toFixed(2)}%`);
      });
    }
  }
  console.log('');
  
  // Test B: Array.from() copy
  console.log('   Test B: Array.from() copy');
  const embeddingCopy = Array.from(queryEmbedding);
  const { data: resultsB, error: errorB } = await supabase.rpc(
    'search_items_across_shops_by_similarity',
    {
      p_shop_ids: [shopId],
      p_query_embedding: embeddingCopy,
      p_limit: 10,
      p_min_similarity: 0.0,
    }
  );
  
  if (errorB) {
    console.error('      ❌ Error:', errorB.message);
  } else {
    console.log(`      ✅ Success: ${resultsB?.length || 0} results`);
  }
  console.log('');
  
  // Step 4: Check if items are active and shop is open
  console.log('4. Checking shop and item status...');
  const { data: shopData, error: shopError } = await supabase
    .from('shops')
    .select('id, name, is_open')
    .eq('id', shopId)
    .single();
  
  if (shopError) {
    console.error('   ❌ Error:', shopError.message);
  } else {
    console.log(`   Shop: ${shopData?.name}`);
    console.log(`   Is Open: ${shopData?.is_open}`);
  }
  
  const { data: itemsData, error: itemsError } = await supabase
    .from('merchant_items')
    .select('id, name, is_active')
    .eq('shop_id', shopId)
    .eq('is_active', true);
  
  if (itemsError) {
    console.error('   ❌ Error:', itemsError.message);
  } else {
    console.log(`   Active Items: ${itemsData?.length || 0}`);
  }
  console.log('');
  
  // Step 5: Try calling a simpler test function
  console.log('5. Testing with a stored embedding as query...');
  if (embeddings && embeddings.length > 0) {
    const firstEmbedding = embeddings[0];
    let storedEmb: number[] | null = null;
    
    if (typeof firstEmbedding.embedding === 'string') {
      try {
        storedEmb = JSON.parse(firstEmbedding.embedding);
      } catch (e) {
        console.error('   ❌ Failed to parse stored embedding');
      }
    } else if (Array.isArray(firstEmbedding.embedding)) {
      storedEmb = firstEmbedding.embedding;
    }
    
    if (storedEmb && storedEmb.length === 1536) {
      console.log('   Using stored embedding as query (should match itself)...');
      const { data: resultsC, error: errorC } = await supabase.rpc(
        'search_items_across_shops_by_similarity',
        {
          p_shop_ids: [shopId],
          p_query_embedding: storedEmb,
          p_limit: 10,
          p_min_similarity: 0.9, // High threshold - should only match itself
        }
      );
      
      if (errorC) {
        console.error('      ❌ Error:', errorC.message);
        console.error('         Code:', errorC.code);
        console.error('         Details:', errorC.details);
      } else {
        console.log(`      ✅ Success: ${resultsC?.length || 0} results`);
        if (resultsC && resultsC.length > 0) {
          resultsC.forEach((item: any) => {
            console.log(`         - ${item.item_name}: ${(item.similarity * 100).toFixed(2)}%`);
          });
        } else {
          console.log('      ⚠️  No results even with stored embedding!');
        }
      }
    }
  }
  
  console.log('\n=== DEBUG COMPLETE ===');
}

debugRPC().catch(console.error);

