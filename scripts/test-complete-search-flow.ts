/**
 * Test Complete Search Flow
 * 
 * Tests the entire flow: query → intent → search → results → matching → cart
 * to identify where items are being dropped.
 */

import { intelligentSearch } from '../src/services/ai/intelligentSearchService';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function testCompleteFlow() {
  console.log('=== TESTING COMPLETE SEARCH FLOW ===\n');
  
  const testQuery = '2 Oreo mini, 3 Rio biscuit, 1 Capstan';
  const latitude = 31.45177339;
  const longitude = 74.43527928;
  
  console.log(`Query: "${testQuery}"`);
  console.log(`Location: ${latitude}, ${longitude}\n`);
  
  let progressSteps: any[] = [];
  
  const result = await intelligentSearch(testQuery, latitude, longitude, {
    maxShops: 10,
    itemsPerShop: 10,
    minSimilarity: 0.35,
    onProgress: (progress) => {
      progressSteps = progress.steps;
      console.log(`\n[Progress] Step: ${progress.currentStepId || 'none'}`);
      progress.steps.forEach((step: any) => {
        const status = step.status === 'completed' ? '✅' : step.status === 'active' ? '🔄' : '⏳';
        console.log(`  ${status} ${step.label}`);
      });
    },
  });
  
  console.log('\n=== SEARCH RESULTS ===');
  
  if (result.error) {
    console.error('❌ Error:', result.error);
    return;
  }
  
  if (!result.data) {
    console.error('❌ No data returned');
    return;
  }
  
  const { results, intent } = result.data;
  
  console.log(`\n📊 Found ${results.length} shop(s) with items`);
  console.log(`📝 Extracted Items: ${intent.extractedItems.length}`);
  intent.extractedItems.forEach((item: any, idx: number) => {
    console.log(`   ${idx + 1}. ${item.name} (${item.brand || 'no brand'}) - Qty: ${item.quantity || 1}`);
  });
  
  results.forEach((shopResult: any, idx: number) => {
    console.log(`\n🏪 Shop ${idx + 1}: ${shopResult.shop.name}`);
    console.log(`   Relevance: ${(shopResult.relevanceScore * 100).toFixed(1)}%`);
    console.log(`   Matching Items: ${shopResult.matchingItems.length}`);
    
    // Check which extracted items match
    const extractedItemNames = intent.extractedItems.map((ei: any) => ei.name.toLowerCase());
    shopResult.matchingItems.forEach((item: any) => {
      const itemNameLower = item.item_name.toLowerCase();
      const matchesExtracted = extractedItemNames.some(extractedName => 
        itemNameLower.includes(extractedName) || extractedName.includes(itemNameLower.split(' ')[0])
      );
      const matchIcon = matchesExtracted ? '✅' : '⚠️';
      console.log(`   ${matchIcon} ${item.item_name} - ${(item.similarity * 100).toFixed(0)}% (${matchesExtracted ? 'MATCHES' : 'NO MATCH'})`);
    });
    
    // Check which extracted items are missing
    const foundItemNames = shopResult.matchingItems.map((item: any) => item.item_name.toLowerCase());
    const missingItems = intent.extractedItems.filter((extracted: any) => {
      const extractedNameLower = extracted.name.toLowerCase();
      return !foundItemNames.some((foundName: string) => 
        foundName.includes(extractedNameLower) || extractedNameLower.includes(foundName.split(' ')[0])
      );
    });
    
    if (missingItems.length > 0) {
      console.log(`\n   ❌ Missing Extracted Items:`);
      missingItems.forEach((item: any) => {
        console.log(`      - ${item.name} (${item.brand || 'no brand'})`);
      });
    }
  });
  
  console.log('\n=== TEST COMPLETE ===');
}

testCompleteFlow().catch(console.error);

