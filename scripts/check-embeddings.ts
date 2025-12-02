/**
 * Check Embeddings Diagnostic Script
 * 
 * Checks if embeddings exist in the database and diagnoses vector search issues.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('=== EMBEDDINGS DIAGNOSTIC ===\n');
  
  try {
    // 1. Check total embeddings count
    console.log('1. Checking total embeddings count...');
    const { count: totalCount, error: countError } = await supabase
      .from('merchant_item_embeddings')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('   ❌ Error:', countError.message);
    } else {
      console.log(`   ✅ Total embeddings: ${totalCount || 0}`);
    }
    
    // 2. Check embeddings with actual vector data
    console.log('\n2. Checking embeddings with non-null vectors...');
    const { count: nonNullCount, error: nonNullError } = await supabase
      .from('merchant_item_embeddings')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);
    
    if (nonNullError) {
      console.error('   ❌ Error:', nonNullError.message);
    } else {
      console.log(`   ✅ Embeddings with non-null vectors: ${nonNullCount || 0}`);
    }
    
    // 3. Check specific items: Oreo, Capstan, Dunhill
    console.log('\n3. Checking specific test items...');
    const testItems = ['oreo', 'capstan', 'dunhill'];
    
    for (const itemName of testItems) {
      console.log(`\n   Searching for "${itemName}"...`);
      
      const { data: items, error: itemError } = await supabase
        .from('merchant_items')
        .select(`
          id,
          name,
          shop_id,
          is_active,
          merchant_item_embeddings!left (
            id,
            embedding
          )
        `)
        .ilike('name', `%${itemName}%`)
        .limit(5);
      
      if (itemError) {
        console.error(`   ❌ Error:`, itemError.message);
      } else if (!items || items.length === 0) {
        console.log(`   ⚠️  No items found with name containing "${itemName}"`);
      } else {
        console.log(`   ✅ Found ${items.length} item(s):`);
        items.forEach((item: any, idx: number) => {
          const embedding = item.merchant_item_embeddings;
          const hasEmbedding = Array.isArray(embedding) 
            ? embedding.length > 0 && embedding[0]?.embedding !== null
            : embedding?.embedding !== null;
          
          console.log(`      ${idx + 1}. ${item.name}`);
          console.log(`         Shop ID: ${item.shop_id.substring(0, 8)}...`);
          console.log(`         Active: ${item.is_active}`);
          console.log(`         Has embedding: ${hasEmbedding ? '✅' : '❌'}`);
        });
      }
    }
    
    // 4. Check if vector search functions exist
    console.log('\n4. Checking if vector search functions exist...');
    const { data: functions, error: funcError } = await supabase.rpc('pg_get_functiondef', {
      funcid: 'search_items_across_shops_by_similarity'
    }).single();
    
    if (funcError) {
      console.error('   ❌ Function may not exist or error occurred:', funcError.message);
    } else {
      console.log('   ✅ Function exists');
    }
    
    // 5. Try a sample vector search
    console.log('\n5. Testing sample vector search...');
    
    // Get a shop ID first
    const { data: shops, error: shopError } = await supabase
      .from('shops')
      .select('id, name')
      .eq('is_open', true)
      .limit(1);
    
    if (shopError || !shops || shops.length === 0) {
      console.error('   ❌ No shops found for testing');
    } else {
      const shopId = shops[0].id;
      console.log(`   Testing with shop: ${shops[0].name} (${shopId.substring(0, 8)}...)`);
      
      // Create a dummy embedding (all zeros)
      const dummyEmbedding = new Array(1536).fill(0);
      
      try {
        const { data: results, error: searchError } = await supabase.rpc(
          'search_items_across_shops_by_similarity',
          {
            p_shop_ids: [shopId],
            p_query_embedding: dummyEmbedding,
            p_limit: 5,
            p_min_similarity: 0.5,
          }
        );
        
        if (searchError) {
          console.error('   ❌ Search error:', searchError.message);
          console.error('      Code:', searchError.code);
          console.error('      Details:', searchError.details);
        } else {
          console.log(`   ✅ Search succeeded, returned ${results?.length || 0} results`);
          if (results && results.length > 0) {
            console.log(`      Sample result: ${results[0].item_name}`);
          }
        }
      } catch (error: any) {
        console.error('   ❌ Exception during search:', error.message);
      }
    }
    
    console.log('\n=== DIAGNOSTIC COMPLETE ===');
    
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();

