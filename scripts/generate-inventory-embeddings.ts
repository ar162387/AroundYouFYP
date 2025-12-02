/**
 * Generate Inventory Embeddings Script
 * 
 * Generates and stores vector embeddings for all merchant items in the database.
 * Run this script after creating the merchant_item_embeddings table.
 * 
 * Usage:
 *   npx ts-node scripts/generate-inventory-embeddings.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import OpenAI directly for this script to avoid dependency issues
import OpenAI from 'openai';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize OpenAI client
const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) {
  console.error('Error: OPENAI_API_KEY must be set in .env');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: openaiApiKey,
});

interface MerchantItem {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  categories?: string[]; // Category names as strings
}

async function fetchAllActiveItems(): Promise<MerchantItem[]> {
  console.log('Fetching all active merchant items...');
  
  // Query items with categories - using alias pattern like inventoryService
  const { data, error } = await supabase
    .from('merchant_items')
    .select(`
      id,
      shop_id,
      name,
      description,
      is_active,
      categories:merchant_item_categories (
        merchant_categories (
          name
        )
      )
    `)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching items:', error);
    throw error;
  }

  // Transform the data - extract category names from nested structure
  // Pattern matches inventoryService: categories:merchant_item_categories(merchant_categories(*))
  const items = (data || []).map((item: any) => {
    let categoryNames: string[] = [];
    
    // 'categories' is alias for merchant_item_categories, each has nested merchant_categories
    if (item.categories) {
      // Map to get merchant_categories objects (same pattern as inventoryService line 246)
      const merchantCategories = Array.isArray(item.categories) 
        ? item.categories.map((c: any) => c.merchant_categories)
        : [item.categories.merchant_categories];
      
      categoryNames = merchantCategories
        .filter((mc: any) => mc && mc.name)
        .map((mc: any) => mc.name);
    }
    
    return {
      id: item.id,
      shop_id: item.shop_id,
      name: item.name || '',
      description: item.description,
      is_active: item.is_active,
      categories: categoryNames,
    };
  });

  console.log(`Found ${items.length} active items`);
  return items;
}

async function checkExistingEmbedding(itemId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('merchant_item_embeddings')
    .select('id')
    .eq('merchant_item_id', itemId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error(`Error checking embedding for item ${itemId}:`, error);
  }

  return !!data;
}

async function generateAndStoreEmbedding(item: MerchantItem, batchIndex: number, total: number): Promise<boolean> {
  try {
    // Check if embedding already exists
    const exists = await checkExistingEmbedding(item.id);
    
    if (exists) {
      console.log(`[${batchIndex + 1}/${total}] Skipping ${item.name} (embedding already exists)`);
      return true;
    }

    // Generate search text (combine name, description, and categories)
    const parts: string[] = [item.name];
    if (item.description) {
      parts.push(item.description);
    }
    if (item.categories && item.categories.length > 0) {
      parts.push(item.categories.join(', '));
    }
    const searchText = parts.join('. ');

    // Generate embedding
    console.log(`[${batchIndex + 1}/${total}] Generating embedding for: ${item.name}`);
    
    let embedding: number[] | null = null;
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: searchText,
      });
      
      if (response.data && response.data.length > 0) {
        embedding = response.data[0].embedding;
      }
    } catch (error: any) {
      console.error(`Error generating embedding for ${item.name}:`, error?.message || error);
      return false;
    }

    if (!embedding) {
      console.error(`Failed to generate embedding for ${item.name}`);
      return false;
    }

    // Validate embedding format
    if (!Array.isArray(embedding)) {
      console.error(`Invalid embedding format for ${item.name}: expected array, got ${typeof embedding}`);
      return false;
    }

    if (embedding.length !== 1536) {
      console.error(`Invalid embedding dimension for ${item.name}: expected 1536, got ${embedding.length}`);
      return false;
    }

    // Store embedding
    // Supabase JS client automatically converts JavaScript arrays to PostgreSQL vector type
    const { error: insertError } = await supabase
      .from('merchant_item_embeddings')
      .insert({
        merchant_item_id: item.id,
        shop_id: item.shop_id,
        embedding: embedding, // Array of 1536 numbers - Supabase handles conversion
        search_text: searchText,
      });

    if (insertError) {
      console.error(`Error storing embedding for ${item.name}:`, insertError);
      return false;
    }

    console.log(`[${batchIndex + 1}/${total}] ✓ Successfully stored embedding for: ${item.name}`);
    return true;
  } catch (error: any) {
    console.error(`Exception processing ${item.name}:`, error);
    return false;
  }
}

async function checkExistingEmbeddingsCount(): Promise<number> {
  const { count, error } = await supabase
    .from('merchant_item_embeddings')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.warn('Warning: Could not check existing embeddings count:', error);
    return 0;
  }

  return count || 0;
}

async function main() {
  console.log('=== Generating Inventory Embeddings ===\n');

  try {
    // Check existing embeddings count
    const existingCount = await checkExistingEmbeddingsCount();
    console.log(`Existing embeddings in database: ${existingCount}\n`);

    // Fetch all items
    const items = await fetchAllActiveItems();

    if (items.length === 0) {
      console.log('No items to process. Exiting.');
      return;
    }

    // Process items in batches to avoid rate limiting
    const BATCH_SIZE = 10;
    const BATCH_DELAY_MS = 2000; // 2 second delay between batches
    
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      
      console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(items.length / BATCH_SIZE)}...`);
      
      const results = await Promise.allSettled(
        batch.map((item, batchIndex) => generateAndStoreEmbedding(item, i + batchIndex, items.length))
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (result.value === true) {
            // Check if it was skipped (embedding already existed)
            // We can't easily distinguish this, so we'll count all successes
            successCount++;
          } else {
            failureCount++;
          }
        } else {
          console.error(`Failed to process item in batch:`, result.reason);
          failureCount++;
        }
      });

      // Delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < items.length) {
        console.log(`Waiting ${BATCH_DELAY_MS}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    // Check final count
    const finalCount = await checkExistingEmbeddingsCount();

    console.log('\n=== Summary ===');
    console.log(`Total items: ${items.length}`);
    console.log(`Successfully processed: ${successCount}`);
    console.log(`Failed: ${failureCount}`);
    console.log(`Total embeddings in database: ${finalCount}`);
    
    if (finalCount === 0 && successCount === 0) {
      console.log('\n⚠️  WARNING: No embeddings were generated!');
      console.log('   This could mean:');
      console.log('   1. All items already had embeddings (check skipped items)');
      console.log('   2. Embedding generation failed for all items');
      console.log('   3. Database insertion failed');
    } else if (finalCount < items.length) {
      console.log(`\n⚠️  WARNING: Only ${finalCount} embeddings exist for ${items.length} items`);
      console.log('   Some items may not have embeddings. Re-run the script to generate missing embeddings.');
    } else {
      console.log(`\n✓ Embedding generation complete! All ${items.length} items have embeddings.`);
    }
  } catch (error: any) {
    console.error('\n✗ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main();

