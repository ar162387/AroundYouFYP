/**
 * Diagnose Embedding Format
 * 
 * Checks how embeddings are actually stored and retrieved from the database.
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

async function diagnoseEmbeddingFormat() {
  console.log('=== DIAGNOSING EMBEDDING FORMAT ===\n');
  
  const itemId = 'a9697f6f-3a22-4d7a-b541-228e9eeca7ab'; // Oreo Mini
  
  // Method 1: Direct select
  console.log('METHOD 1: Direct SELECT from table...');
  const { data: directData, error: directError } = await supabase
    .from('merchant_item_embeddings')
    .select('merchant_item_id, embedding, search_text')
    .eq('merchant_item_id', itemId)
    .single();
  
  if (directError) {
    console.error('❌ Error:', directError.message);
  } else if (directData) {
    console.log('✅ Data retrieved');
    console.log('   Type of embedding:', typeof directData.embedding);
    console.log('   Is Array:', Array.isArray(directData.embedding));
    console.log('   Is String:', typeof directData.embedding === 'string');
    
    if (typeof directData.embedding === 'string') {
      console.log('   String length:', directData.embedding.length);
      console.log('   First 100 chars:', directData.embedding.substring(0, 100));
      
      // Try to parse as JSON
      try {
        const parsed = JSON.parse(directData.embedding);
        console.log('   ✅ Parsed as JSON');
        console.log('   Parsed type:', typeof parsed);
        console.log('   Parsed is Array:', Array.isArray(parsed));
        if (Array.isArray(parsed)) {
          console.log('   Parsed array length:', parsed.length);
          console.log('   First 5 values:', parsed.slice(0, 5));
        }
      } catch (e) {
        console.log('   ❌ Not valid JSON');
      }
    } else if (Array.isArray(directData.embedding)) {
      console.log('   Array length:', directData.embedding.length);
      console.log('   First 5 values:', directData.embedding.slice(0, 5));
    } else {
      console.log('   Value:', directData.embedding);
    }
  }
  console.log('');
  
  // Method 2: RPC function that returns embedding
  console.log('METHOD 2: Check via RPC function...');
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'search_items_by_similarity',
    {
      p_shop_id: '57e9fd69-517a-4a03-8a7d-818fc6844e3b',
      p_query_embedding: new Array(1536).fill(0), // Dummy embedding
      p_limit: 1,
      p_min_similarity: 0.0, // Very low to get any result
    }
  );
  
  if (rpcError) {
    console.error('❌ RPC Error:', rpcError.message);
    console.error('   Code:', rpcError.code);
    console.error('   Details:', rpcError.details);
  } else {
    console.log('✅ RPC succeeded');
    console.log('   Results:', rpcData?.length || 0);
  }
  console.log('');
  
  // Method 3: Check migration files for column type
  console.log('METHOD 3: Column type from migrations...');
  console.log('   According to migrations, embedding should be: vector(1536)');
  console.log('   This is a PostgreSQL extension type (pgvector)');
  console.log('');
  
  // Method 4: Try to understand the string format
  if (directData && typeof directData.embedding === 'string') {
    console.log('METHOD 4: Analyzing string format...');
    const embStr = directData.embedding;
    
    // Check if it's PostgreSQL vector format: [1,2,3,...]
    if (embStr.startsWith('[') && embStr.endsWith(']')) {
      console.log('   ✅ Appears to be PostgreSQL vector format');
      console.log('   Format: [value1,value2,value3,...]');
      
      // Try to parse by removing brackets and splitting
      const values = embStr.slice(1, -1).split(',');
      console.log('   Number of values:', values.length);
      console.log('   First 5 values:', values.slice(0, 5));
      
      // Try converting to numbers
      const numValues = values.slice(0, 10).map(v => {
        try {
          return parseFloat(v.trim());
        } catch {
          return null;
        }
      });
      console.log('   First 5 as numbers:', numValues);
    } else {
      console.log('   ⚠️  Unknown format');
    }
  }
  
  console.log('\n=== DIAGNOSIS COMPLETE ===');
  console.log('\n💡 RECOMMENDATION:');
  console.log('   If embedding is returned as a string, we need to:');
  console.log('   1. Parse it properly (might be PostgreSQL vector format)');
  console.log('   2. Or use a different method to retrieve it');
  console.log('   3. Or regenerate embeddings if they were stored incorrectly');
}

diagnoseEmbeddingFormat().catch(console.error);

