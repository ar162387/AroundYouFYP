/**
 * Test RPC with Stored Embedding
 * 
 * Tests if the RPC function works when we use an actual stored embedding
 * from the database as the query embedding.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Required environment variables must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testRPCWithStoredEmbedding() {
  console.log('=== TESTING RPC WITH STORED EMBEDDING ===\n');
  
  const shopId = '57e9fd69-517a-4a03-8a7d-818fc6844e3b';
  const oreoItemId = 'a9697f6f-3a22-4d7a-b541-228e9eeca7ab';
  
  // Get the stored embedding
  console.log('1. Fetching stored embedding from database...');
  const { data: storedEmbedding, error: fetchError } = await supabase
    .from('merchant_item_embeddings')
    .select('embedding, search_text')
    .eq('merchant_item_id', oreoItemId)
    .single();
  
  if (fetchError || !storedEmbedding) {
    console.error('❌ Error fetching embedding:', fetchError?.message);
    return;
  }
  
  console.log('✅ Fetched embedding');
  console.log('   Search text:', storedEmbedding.search_text);
  
  // Parse embedding
  let embeddingArray: number[] | null = null;
  if (typeof storedEmbedding.embedding === 'string') {
    try {
      const parsed = JSON.parse(storedEmbedding.embedding);
      if (Array.isArray(parsed)) {
        embeddingArray = parsed;
        console.log('   ✅ Parsed as JSON array');
        console.log('   Dimensions:', parsed.length);
      }
    } catch (e) {
      console.error('❌ Failed to parse:', e);
      return;
    }
  } else if (Array.isArray(storedEmbedding.embedding)) {
    embeddingArray = storedEmbedding.embedding;
    console.log('   ✅ Already an array');
    console.log('   Dimensions:', storedEmbedding.embedding.length);
  }
  
  if (!embeddingArray || embeddingArray.length !== 1536) {
    console.error('❌ Invalid embedding format');
    return;
  }
  
  const validEmbedding: number[] = embeddingArray; // TypeScript guard
  
  // Test 1: Use stored embedding as query (should match itself with 100% similarity)
  console.log('\n2. Testing RPC with stored embedding as query (should match itself)...');
  const { data: results1, error: error1 } = await supabase.rpc(
    'search_items_across_shops_by_similarity',
    {
      p_shop_ids: [shopId],
      p_query_embedding: validEmbedding,
      p_limit: 10,
      p_min_similarity: 0.9, // High threshold - should only match itself
    }
  );
  
  if (error1) {
    console.error('❌ RPC Error:', error1.message);
    console.error('   Code:', error1.code);
    console.error('   Details:', error1.details);
    console.error('   Hint:', error1.hint);
  } else {
    console.log(`✅ RPC succeeded: ${results1?.length || 0} results`);
    if (results1 && results1.length > 0) {
      console.log('\n   Top results:');
      results1.slice(0, 3).forEach((item: any, idx: number) => {
        console.log(`   ${idx + 1}. ${item.item_name}`);
        console.log(`      Similarity: ${(item.similarity * 100).toFixed(2)}%`);
      });
    } else {
      console.log('   ⚠️  No results even when querying with stored embedding!');
      console.log('   This suggests the RPC function has an issue with vector comparison');
    }
  }
  
  // Test 2: Try with lower threshold
  console.log('\n3. Testing with lower threshold (0.3)...');
  const { data: results2, error: error2 } = await supabase.rpc(
    'search_items_across_shops_by_similarity',
    {
      p_shop_ids: [shopId],
      p_query_embedding: validEmbedding,
      p_limit: 10,
      p_min_similarity: 0.3,
    }
  );
  
  if (error2) {
    console.error('❌ RPC Error:', error2.message);
  } else {
    console.log(`✅ RPC succeeded: ${results2?.length || 0} results`);
    if (results2 && results2.length > 0) {
      console.log('\n   Top results:');
      results2.slice(0, 5).forEach((item: any, idx: number) => {
        console.log(`   ${idx + 1}. ${item.item_name}`);
        console.log(`      Similarity: ${(item.similarity * 100).toFixed(2)}%`);
      });
    }
  }
  
  // Test 3: Try with a new embedding generated from OpenAI
  console.log('\n4. Testing with fresh OpenAI embedding...');
  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: 'Oreo mini',
  });
  
  const freshEmbedding = embeddingResponse.data[0].embedding;
  console.log('   ✅ Generated fresh embedding:', freshEmbedding.length, 'dimensions');
  
  const { data: results3, error: error3 } = await supabase.rpc(
    'search_items_across_shops_by_similarity',
    {
      p_shop_ids: [shopId],
      p_query_embedding: freshEmbedding,
      p_limit: 10,
      p_min_similarity: 0.3,
    }
  );
  
  if (error3) {
    console.error('❌ RPC Error:', error3.message);
    console.error('   Code:', error3.code);
    console.error('   Details:', error3.details);
  } else {
    console.log(`✅ RPC succeeded: ${results3?.length || 0} results`);
    if (results3 && results3.length > 0) {
      console.log('\n   Top results:');
      results3.slice(0, 5).forEach((item: any, idx: number) => {
        console.log(`   ${idx + 1}. ${item.item_name}`);
        console.log(`      Similarity: ${(item.similarity * 100).toFixed(2)}%`);
      });
    } else {
      console.log('   ⚠️  No results with fresh embedding either!');
    }
  }
  
  console.log('\n=== TEST COMPLETE ===');
}

testRPCWithStoredEmbedding().catch(console.error);

