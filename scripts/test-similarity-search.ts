/**
 * Test Similarity Search for Specific Items
 * 
 * Tests vector similarity search with actual embeddings for the known items:
 * - Oreo mini
 * - Rio biscuit  
 * - Capstan
 * 
 * This will help diagnose why vector search returns 0 results.
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

interface TestCase {
  query: string;
  expectedItemName: string;
  expectedItemId?: string;
}

async function testSimilaritySearch() {
  console.log('=== SIMILARITY SEARCH TEST FOR SPECIFIC ITEMS ===\n');
  
  const shopId = '57e9fd69-517a-4a03-8a7d-818fc6844e3b'; // freshly Askari XI
  const shopIds = [shopId];
  
  // We'll build test cases dynamically after fetching items
  let testCases: TestCase[] = [];
  
  // Step 1: Verify items exist and build test cases
  console.log('STEP 1: Verifying items exist in database...\n');
  const { data: items, error: itemsError } = await supabase
    .from('merchant_items')
    .select('id, name, shop_id, is_active, price_cents')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .or('name.ilike.%oreo%,name.ilike.%rio%,name.ilike.%capstan%');
  
  if (itemsError) {
    console.error('❌ Error fetching items:', itemsError.message);
    return;
  }
  
  console.log(`✅ Found ${items?.length || 0} items in shop:`);
  items?.forEach((item: any) => {
    console.log(`   - ${item.name}`);
    console.log(`     ID: ${item.id}`);
    console.log(`     Price: PKR ${(item.price_cents / 100).toFixed(2)}`);
    console.log(`     Active: ${item.is_active}`);
    console.log('');
  });
  
  // Build test cases dynamically based on found items
  const oreoItem = items?.find((i: any) => i.name.toLowerCase().includes('oreo'));
  const rioItem = items?.find((i: any) => i.name.toLowerCase().includes('rio'));
  const capstanItem = items?.find((i: any) => i.name.toLowerCase().includes('capstan'));
  
  testCases = [
    {
      query: 'Oreo mini',
      expectedItemName: oreoItem?.name || 'Oreo Mini Original Munch Pack 1 Piece',
      expectedItemId: oreoItem?.id,
    },
    {
      query: 'Rio biscuit',
      expectedItemName: rioItem?.name || 'Peek Freans Rio Strawberry Vanilla Family Pack',
      expectedItemId: rioItem?.id,
    },
    {
      query: 'Capstan',
      expectedItemName: capstanItem?.name || 'Capstan by Pall Mall',
      expectedItemId: capstanItem?.id,
    },
    // Additional expanded queries
    {
      query: 'cookies',
      expectedItemName: oreoItem?.name || 'Oreo Mini Original Munch Pack 1 Piece',
      expectedItemId: oreoItem?.id,
    },
    {
      query: 'biscuits',
      expectedItemName: rioItem?.name || 'Peek Freans Rio Strawberry Vanilla Family Pack',
      expectedItemId: rioItem?.id,
    },
    {
      query: 'cigarettes',
      expectedItemName: capstanItem?.name || 'Capstan by Pall Mall',
      expectedItemId: capstanItem?.id,
    },
  ];
  
  // Step 2: Verify embeddings exist
  console.log('STEP 2: Verifying embeddings exist...\n');
  let embeddings: any[] | null = null;
  if (items && items.length > 0) {
    const itemIds = items.map(i => i.id);
    const { data: embeddingsData, error: embError } = await supabase
      .from('merchant_item_embeddings')
      .select('merchant_item_id, embedding, search_text')
      .in('merchant_item_id', itemIds);
    
    if (embError) {
      console.error('❌ Error fetching embeddings:', embError.message);
      return;
    }
    
    embeddings = embeddingsData;
    console.log(`✅ Found ${embeddings?.length || 0} embeddings:`);
    embeddings?.forEach((emb: any) => {
      const item = items.find(i => i.id === emb.merchant_item_id);
      const hasEmbedding = emb.embedding !== null;
      
      // Parse embedding if it's a string (Supabase returns vector as JSON string)
      let embeddingArray: number[] | null = null;
      let embeddingLength = 0;
      if (hasEmbedding) {
        if (typeof emb.embedding === 'string') {
          try {
            const parsed = JSON.parse(emb.embedding);
            if (Array.isArray(parsed)) {
              embeddingArray = parsed;
              embeddingLength = parsed.length;
            }
          } catch {
            embeddingLength = 0;
          }
        } else if (Array.isArray(emb.embedding)) {
          embeddingArray = emb.embedding;
          embeddingLength = emb.embedding.length;
        }
      }
      
      console.log(`   - ${item?.name || 'Unknown'}:`);
      console.log(`     Has embedding: ${hasEmbedding ? '✅' : '❌'}`);
      console.log(`     Embedding dimensions: ${embeddingLength}`);
      console.log(`     Search text: ${emb.search_text || 'N/A'}`);
      console.log('');
    });
  }
  
  // Step 3: Test vector search for each query
  console.log('STEP 3: Testing vector similarity search...\n');
  console.log('='.repeat(80));
  
  for (const testCase of testCases) {
    console.log(`\n🔍 Testing Query: "${testCase.query}"`);
    console.log(`   Expected to find: "${testCase.expectedItemName}"`);
    console.log('-'.repeat(80));
    
    try {
      // Generate embedding for query
      console.log('\n1️⃣  Generating query embedding...');
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: testCase.query,
      });
      
      const queryEmbedding = embeddingResponse.data[0].embedding;
      console.log(`   ✅ Generated embedding: ${queryEmbedding.length} dimensions`);
      console.log(`   First 5 values: [${queryEmbedding.slice(0, 5).map(v => v.toFixed(6)).join(', ')}]`);
      
      // Test with different similarity thresholds
      const thresholds = [0.5, 0.4, 0.35, 0.3, 0.25, 0.2];
      
      for (const threshold of thresholds) {
        console.log(`\n2️⃣  Testing with similarity threshold: ${threshold}`);
        
        const { data: results, error: searchError } = await supabase.rpc(
          'search_items_across_shops_by_similarity',
          {
            p_shop_ids: shopIds,
            p_query_embedding: queryEmbedding,
            p_limit: 20,
            p_min_similarity: threshold,
          }
        );
        
        if (searchError) {
          console.error(`   ❌ Search error at threshold ${threshold}:`, searchError.message);
          console.error(`      Code: ${searchError.code}`);
          console.error(`      Details: ${searchError.details}`);
          console.error(`      Hint: ${searchError.hint}`);
          continue;
        }
        
        const resultCount = results?.length || 0;
        console.log(`   📊 Results: ${resultCount} item(s) found`);
        
        if (results && results.length > 0) {
          // Check if expected item is in results
          const expectedItem = results.find((r: any) => 
            r.item_name.toLowerCase().includes(testCase.expectedItemName.toLowerCase()) ||
            testCase.expectedItemName.toLowerCase().includes(r.item_name.toLowerCase())
          );
          
          if (expectedItem) {
            console.log(`   ✅ Expected item FOUND!`);
            console.log(`      Name: ${expectedItem.item_name}`);
            console.log(`      Similarity: ${(expectedItem.similarity * 100).toFixed(2)}%`);
            console.log(`      Price: PKR ${(expectedItem.price_cents / 100).toFixed(2)}`);
          } else {
            console.log(`   ⚠️  Expected item NOT in results`);
          }
          
          // Show top 3 results
          console.log(`\n   Top ${Math.min(3, results.length)} results:`);
          results.slice(0, 3).forEach((item: any, idx: number) => {
            console.log(`      ${idx + 1}. ${item.item_name}`);
            console.log(`         Similarity: ${(item.similarity * 100).toFixed(2)}%`);
            console.log(`         Price: PKR ${(item.price_cents / 100).toFixed(2)}`);
          });
          
          // If we found results, no need to test lower thresholds
          if (resultCount > 0) {
            break;
          }
        } else {
          console.log(`   ⚠️  No results at threshold ${threshold}`);
        }
      }
      
      // Step 4: Manual similarity check - get item embedding and calculate similarity
      console.log(`\n3️⃣  Manual similarity check...`);
      if (testCase.expectedItemId) {
        const { data: itemEmbedding, error: embError } = await supabase
          .from('merchant_item_embeddings')
          .select('embedding, search_text')
          .eq('merchant_item_id', testCase.expectedItemId)
          .single();
        
        if (embError || !itemEmbedding || !itemEmbedding.embedding) {
          console.log(`   ⚠️  Could not fetch item embedding: ${embError?.message || 'Not found'}`);
        } else {
          // Parse embedding if it's a string (Supabase returns vector as JSON string)
          let itemEmb: number[] | null = null;
          if (typeof itemEmbedding.embedding === 'string') {
            try {
              itemEmb = JSON.parse(itemEmbedding.embedding);
            } catch (e) {
              console.log(`   ❌ Failed to parse embedding as JSON: ${e}`);
            }
          } else if (Array.isArray(itemEmbedding.embedding)) {
            itemEmb = itemEmbedding.embedding;
          }
          
          if (!itemEmb) {
            console.log(`   ❌ Could not parse item embedding`);
          } else if (itemEmb.length === queryEmbedding.length) {
            // Calculate cosine similarity manually
            // Cosine similarity: dot product / (norm1 * norm2)
            let dotProduct = 0;
            let norm1 = 0;
            let norm2 = 0;
            
            for (let i = 0; i < queryEmbedding.length; i++) {
              dotProduct += queryEmbedding[i] * itemEmb[i];
              norm1 += queryEmbedding[i] * queryEmbedding[i];
              norm2 += itemEmb[i] * itemEmb[i];
            }
            
            const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
            console.log(`   📊 Manual similarity calculation:`);
            console.log(`      Query: "${testCase.query}"`);
            console.log(`      Item search text: "${itemEmbedding.search_text || 'N/A'}"`);
            console.log(`      Cosine similarity: ${(similarity * 100).toFixed(2)}%`);
            console.log(`      Distance (1 - similarity): ${((1 - similarity) * 100).toFixed(2)}%`);
            
            if (similarity < 0.35) {
              console.log(`   ⚠️  Similarity is below 0.35 threshold!`);
              console.log(`   💡 This explains why vector search returns 0 results`);
            } else {
              console.log(`   ✅ Similarity is above 0.35 threshold - should appear in search`);
            }
          } else {
            console.log(`   ❌ Dimension mismatch: query=${queryEmbedding.length}, item=${itemEmb.length}`);
          }
        }
      }
      
    } catch (error: any) {
      console.error(`\n❌ Error testing query "${testCase.query}":`, error.message);
      console.error('Stack:', error.stack);
    }
    
    console.log('\n' + '='.repeat(80));
  }
  
  // Step 5: Summary
  console.log('\n\n📋 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Tested ${testCases.length} queries against shop: ${shopId}`);
  console.log(`Items in database: ${items?.length || 0}`);
  console.log(`Embeddings available: ${embeddings?.length || 0}`);
  console.log('\n=== TEST COMPLETE ===');
}

testSimilaritySearch().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

