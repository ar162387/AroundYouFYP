/**
 * Intelligent Search Service
 * 
 * Enhanced search service that uses LLM to understand user intent,
 * intelligently search items across all shops, and match categories.
 * Designed for FMCG Pakistani market with support for brand variations
 * and category synonyms.
 */

import { findShopsByLocation, fetchShopCategories, fetchShopItems } from '../consumer/shopService';
import { searchItemsAcrossShops } from './inventorySearchRAG';
import { retrievePreferencesBySimilarity } from './memoryRetrievalService';
import { createChatCompletion } from './openAIService';
import type { ConsumerShop } from '../consumer/shopService';
import type { SearchItemResultWithShop } from './inventorySearchRAG';

export interface IntelligentSearchResult {
  shop: ConsumerShop;
  matchingItems: SearchItemResultWithShop[];
  categoryMatches: string[]; // Category names that matched
  relevanceScore: number;
}

export interface IntelligentSearchResponse {
  results: IntelligentSearchResult[];
  reasoning: string; // LLM's thought process
  intent: SearchIntent; // Full intent details for debugging
}

export interface SearchIntent {
  primaryQuery: string;
  expandedQueries: string[]; // LLM-generated variations
  categories: string[]; // Category names to search (e.g., "Munchies", "Cold Drinks")
  brands: string[]; // Brand names mentioned
  itemTypes: string[]; // General item types (e.g., "chips", "cold drink")
  extractedItems: Array<{ // Multiple items extracted from query
    name: string;
    brand?: string;
    category?: string;
    searchTerms: string[];
    quantity?: number; // Extracted quantity from query (e.g., "2 always" = 2)
  }>;
  reasoning: string; // LLM's thought process
}

type ServiceResult<T> = { data: T | null; error: string | null };

/**
 * Use LLM to understand user intent and expand the search query
 */
async function understandSearchIntent(
  userQuery: string,
  availableCategories?: string[]
): Promise<ServiceResult<SearchIntent>> {
  try {
    const categoriesContext = availableCategories
      ? `\n\nAvailable categories in shops: ${availableCategories.join(', ')}`
      : '';

    const systemPrompt = `You are a shopping assistant for a Pakistani FMCG (Fast Moving Consumer Goods) marketplace. 
Your task is to understand what the user wants and expand their query intelligently.

CRITICAL: When users mention multiple items (like "pamper and always"), treat them as SEPARATE items, not a single query!

Key considerations:
1. Multiple items: If user mentions "X and Y" or "X, Y", extract them as separate items
2. Quantities: ALWAYS extract quantities from queries (e.g., "2 always" = Always pads, quantity 2; "3 shampoo" = shampoo, quantity 3; "2 bread, 3 milk" = bread quantity 2, milk quantity 3). If no quantity is mentioned, default to 1. NEVER use quantity 0 - if user says "0 X", either omit the item or default to quantity 1.
3. Brand variations: "lays" → "Lay's", "coca cola" → "Coca-Cola", "pamper" → "Pampers", "always" → "Always"
4. Category synonyms: "chips" = "munchies", "cold drink" = "Cold Drinks & Juices", "snacks" = "Munchies", "diapers" = "Baby Care"
5. Pakistani market context: Understand local terms and preferences
6. Be specific but not too broad - don't match every word containing a letter

Return a JSON object with:
- primaryQuery: The main search query (cleaned and normalized)
- expandedQueries: Array of 3-5 search variations (brand names, synonyms, etc.)
- categories: Array of category names that might contain these items
- brands: Array of brand names mentioned or implied
- itemTypes: Array of general item types (e.g., ["chips", "snacks"])
- extractedItems: Array of individual items mentioned (each with name, brand, category, searchTerms, quantity)
- reasoning: Your thought process explaining what you understood from the query

Examples:

User: "pamper, 2 always, 3 shampoo"
Response: {
  "primaryQuery": "pamper, 2 always, 3 shampoo",
  "expandedQueries": ["Pampers", "Always", "shampoo", "diapers", "pads", "hair care"],
  "categories": ["Baby Care", "Personal Care"],
  "brands": ["Pampers", "Always"],
  "itemTypes": ["diapers", "pads", "shampoo"],
  "extractedItems": [
    {
      "name": "Pampers",
      "brand": "Pampers",
      "category": "Baby Care",
      "searchTerms": ["Pampers", "pamper", "diapers", "baby diapers"],
      "quantity": 1
    },
    {
      "name": "Always",
      "brand": "Always",
      "category": "Personal Care",
      "searchTerms": ["Always", "always pads", "sanitary pads", "feminine hygiene"],
      "quantity": 2
    },
    {
      "name": "shampoo",
      "category": "Personal Care",
      "searchTerms": ["shampoo", "hair care", "hair wash", "conditioner"],
      "quantity": 3
    }
  ],
  "reasoning": "User mentioned three separate items with quantities: 'Pampers' (1), 'Always' pads (2), and 'shampoo' (3). These are different products that should be searched separately and added to cart with their respective quantities."
}

User: "2 bread, 3 milk"
Response: {
  "primaryQuery": "2 bread, 3 milk",
  "expandedQueries": ["bread", "loaf", "bakery", "milk", "dairy", "fresh milk"],
  "categories": ["Bakery & Biscuits", "Dairy & Breakfast"],
  "brands": [],
  "itemTypes": ["bread", "milk"],
  "extractedItems": [
    {
      "name": "bread",
      "category": "Bakery & Biscuits",
      "searchTerms": ["bread", "loaf", "bakery"],
      "quantity": 2
    },
    {
      "name": "milk",
      "category": "Dairy & Breakfast",
      "searchTerms": ["milk", "dairy", "fresh milk"],
      "quantity": 3
    }
  ],
  "reasoning": "User mentioned two separate items with quantities: 'bread' (2) and 'milk' (3). These are different products that should be searched separately and added to cart with their respective quantities."
}

User: "0 bread"
Response: {
  "primaryQuery": "bread",
  "expandedQueries": ["bread", "loaf", "bakery bread"],
  "categories": ["Bakery & Biscuits"],
  "brands": [],
  "itemTypes": ["bread"],
  "extractedItems": [
    {
      "name": "bread",
      "category": "Bakery & Biscuits",
      "searchTerms": ["bread", "loaf", "bakery bread"],
      "quantity": 1
    }
  ],
  "reasoning": "User mentioned '0 bread' which is invalid. Treating as a request for bread with default quantity 1."
}

User: "pamper and always"
Response: {
  "primaryQuery": "pamper and always",
  "expandedQueries": ["Pampers", "Always", "diapers", "pads"],
  "categories": ["Baby Care", "Personal Care"],
  "brands": ["Pampers", "Always"],
  "itemTypes": ["diapers", "pads"],
  "extractedItems": [
    {
      "name": "Pampers",
      "brand": "Pampers",
      "category": "Baby Care",
      "searchTerms": ["Pampers", "pamper", "diapers", "baby diapers"],
      "quantity": 1
    },
    {
      "name": "Always",
      "brand": "Always",
      "category": "Personal Care",
      "searchTerms": ["Always", "always pads", "sanitary pads", "feminine hygiene"],
      "quantity": 1
    }
  ],
  "reasoning": "User mentioned two separate brands: 'Pampers' (baby diapers) and 'Always' (sanitary pads). These are different products that should be searched separately. Pampers is in Baby Care category, while Always is in Personal Care."
}

User: "lays"
Response: {
  "primaryQuery": "Lay's",
  "expandedQueries": ["Lay's", "lays", "Lays chips", "potato chips", "crisps"],
  "categories": ["Munchies"],
  "brands": ["Lay's"],
  "itemTypes": ["chips", "snacks"],
  "extractedItems": [
    {
      "name": "Lay's",
      "brand": "Lay's",
      "category": "Munchies",
      "searchTerms": ["Lay's", "lays", "potato chips", "crisps"]
    }
  ],
  "reasoning": "User is looking for Lay's chips, a popular snack brand. This is a single item search for potato chips/crisps."
}

User: "cold drink and chips"
Response: {
  "primaryQuery": "cold drink and chips",
  "expandedQueries": ["cold drink", "soft drink", "chips", "snacks", "cola", "crisps"],
  "categories": ["Cold Drinks & Juices", "Munchies"],
  "brands": [],
  "itemTypes": ["cold drink", "beverage", "chips", "snacks"],
  "extractedItems": [
    {
      "name": "cold drink",
      "category": "Cold Drinks & Juices",
      "searchTerms": ["cold drink", "soft drink", "beverage", "cola", "pepsi", "sprite"]
    },
    {
      "name": "chips",
      "category": "Munchies",
      "searchTerms": ["chips", "crisps", "potato chips", "snacks"]
    }
  ],
  "reasoning": "User wants both a cold drink and chips - two separate items for a snack combo. Cold drink is from beverages category, chips from snacks/munchies."
}${categoriesContext}`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userQuery },
    ];

    const result = await createChatCompletion(messages, {
      temperature: 0.3, // Lower temperature for more consistent parsing
      max_tokens: 500,
    });

    if (result.error || !result.data) {
      // Fallback to simple query expansion
      console.log('[IntelligentSearch] LLM call failed, using fallback intent');
      return {
        data: {
          primaryQuery: userQuery,
          expandedQueries: [userQuery],
          categories: [],
          brands: [],
          itemTypes: [],
          extractedItems: [{ name: userQuery, searchTerms: [userQuery], quantity: 1 }],
          reasoning: 'Fallback: LLM unavailable, using direct query match',
        },
        error: result.error || null,
      };
    }

    const responseText = result.data.choices[0]?.message?.content || '';
    
    // Try to parse JSON from response
    let intent: SearchIntent;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || 
                       responseText.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch ? jsonMatch[1] : responseText;
      intent = JSON.parse(jsonStr);
      
      // Post-process: Ensure quantities are valid (never 0, default to 1 if missing)
      if (intent.extractedItems) {
        intent.extractedItems = intent.extractedItems.map((item: any) => {
          // If quantity is 0, undefined, null, or negative, default to 1
          if (!item.quantity || item.quantity <= 0 || isNaN(item.quantity)) {
            item.quantity = 1;
          }
          return item;
        });
      }
    } catch (parseError) {
      console.warn('[IntelligentSearch] Failed to parse LLM response, using fallback:', parseError);
      // Fallback
      intent = {
        primaryQuery: userQuery,
        expandedQueries: [userQuery],
        categories: [],
        brands: [],
        itemTypes: [],
        extractedItems: [{ name: userQuery, searchTerms: [userQuery], quantity: 1 }],
        reasoning: 'Fallback: Parse error, using direct query match',
      };
    }

    return { data: intent, error: null };
  } catch (error: any) {
    console.error('[IntelligentSearch] Error understanding intent:', error);
    return {
      data: {
        primaryQuery: userQuery,
        expandedQueries: [userQuery],
        categories: [],
        brands: [],
        itemTypes: [],
          extractedItems: [{ name: userQuery, searchTerms: [userQuery], quantity: 1 }],
        reasoning: 'Fallback: Exception occurred, using direct query match',
      },
      error: error?.message || 'Failed to understand search intent',
    };
  }
}

/**
 * Get all categories from shops in the area
 */
async function getAvailableCategories(shopIds: string[]): Promise<string[]> {
  try {
    const categorySet = new Set<string>();
    
    // Fetch categories from all shops in parallel
    const categoryPromises = shopIds.map(async (shopId) => {
      const { data } = await fetchShopCategories(shopId);
      return data || [];
    });

    const categoryArrays = await Promise.all(categoryPromises);
    
    categoryArrays.forEach((categories) => {
      categories.forEach((cat) => {
        categorySet.add(cat.name);
      });
    });

    return Array.from(categorySet);
  } catch (error) {
    console.error('[IntelligentSearch] Error fetching categories:', error);
    return [];
  }
}

/**
 * Search items by category names (handles category synonyms)
 */
async function searchItemsByCategories(
  shopIds: string[],
  categoryNames: string[],
  itemTypes: string[],
  shopNameMap: Map<string, string>
): Promise<SearchItemResultWithShop[]> {
  if (categoryNames.length === 0 && itemTypes.length === 0) {
    return [];
  }

  try {
    // First, get all categories from shops and match by name similarity
    const allItems: SearchItemResultWithShop[] = [];

    for (const shopId of shopIds) {
      // Fetch categories for this shop
      const { data: categories } = await fetchShopCategories(shopId);
      if (!categories) continue;

      // Find matching categories
      const matchingCategoryIds: string[] = [];
      
      for (const category of categories) {
        const categoryNameLower = category.name.toLowerCase();
        
        // Check if category name matches any of the requested categories
        const matchesCategory = categoryNames.some((reqCat) =>
          categoryNameLower.includes(reqCat.toLowerCase()) ||
          reqCat.toLowerCase().includes(categoryNameLower)
        );

        // Check if category name matches item types (e.g., "Munchies" contains "chips")
        const matchesItemType = itemTypes.some((itemType) =>
          categoryNameLower.includes(itemType.toLowerCase()) ||
          itemType.toLowerCase().includes(categoryNameLower)
        );

        if (matchesCategory || matchesItemType) {
          matchingCategoryIds.push(category.id);
        }
      }

      // If we found matching categories, fetch items from those categories
      if (matchingCategoryIds.length > 0) {
        // Fetch items for each matching category
        for (const categoryId of matchingCategoryIds) {
          const { data: items, error } = await fetchShopItems(shopId, categoryId);
          
          if (items && items.length > 0 && !error) {
            const shopName = shopNameMap.get(shopId) || 'Unknown Shop';

            items.forEach((item) => {
              // Check if we already have this item (deduplicate)
              const existing = allItems.find(
                (i) => i.merchant_item_id === item.id && i.shop_id === shopId
              );

              if (!existing) {
                allItems.push({
                  merchant_item_id: item.id,
                  shop_id: shopId,
                  shop_name: shopName,
                  item_name: item.name,
                  item_description: item.description,
                  item_image_url: item.image_url,
                  price_cents: item.price_cents,
                  is_active: item.is_active,
                  similarity: 0.7, // Category match gets good similarity score
                });
              }
            });
          }
        }
      }
    }

    return allItems;
  } catch (error: any) {
    console.error('[IntelligentSearch] Error searching by categories:', error);
    return [];
  }
}

/**
 * Main intelligent search function
 * Searches across all shops in user's area with intelligent query expansion
 */
export async function intelligentSearch(
  userQuery: string,
  latitude: number,
  longitude: number,
  options?: {
    maxShops?: number;
    itemsPerShop?: number;
    minSimilarity?: number;
  }
): Promise<ServiceResult<IntelligentSearchResponse>> {
  console.log('\n=================================================================');
  console.log('[IntelligentSearch] 🚀 STARTING INTELLIGENT SEARCH');
  console.log('=================================================================');
  console.log(`📝 User Query: "${userQuery}"`);
  console.log(`📍 Location: ${latitude}, ${longitude}`);
  console.log(`⚙️  Options:`, options);
  console.log('=================================================================\n');

  try {
    // Step 1: Find shops in user's area
    console.log('[IntelligentSearch] 📍 STEP 1: Finding shops by location...');
    const shopsResult = await findShopsByLocation(latitude, longitude);
    console.log(`[IntelligentSearch] ✅ Found ${shopsResult.data?.length || 0} shops in area`);

    if (shopsResult.error || !shopsResult.data) {
      return {
        data: null,
        error: shopsResult.error?.message || 'Failed to find shops',
      };
    }

    const shops = shopsResult.data;
    const maxShops = options?.maxShops ?? 10; // Search more shops for better coverage
    const topShops = shops.slice(0, maxShops);
    const shopIds = topShops.map((shop) => shop.id);

    if (shopIds.length === 0) {
      console.log('[IntelligentSearch] ⚠️  No shops found in area');
      return { 
        data: {
          results: [],
          reasoning: 'No shops found in your delivery area.',
          intent: {
            primaryQuery: userQuery,
            expandedQueries: [userQuery],
            categories: [],
            brands: [],
            itemTypes: [],
            extractedItems: [],
            reasoning: 'No shops available',
          },
        }, 
        error: null 
      };
    }

    console.log(`[IntelligentSearch] 🏪 Searching across ${shopIds.length} shops:`);
    topShops.forEach((shop, i) => {
      console.log(`  ${i + 1}. ${shop.name} (${shop.id.substring(0, 8)}...)`);
    });

    // Step 2: Get available categories for context
    console.log('\n[IntelligentSearch] 📂 STEP 2: Fetching available categories...');
    const availableCategories = await getAvailableCategories(shopIds);
    console.log(`[IntelligentSearch] ✅ Found ${availableCategories.length} unique categories:`, availableCategories.join(', '));

    // Step 3: Use LLM to understand intent and expand query
    console.log('\n[IntelligentSearch] 🧠 STEP 3: Understanding search intent with LLM...');
    const intentResult = await understandSearchIntent(userQuery, availableCategories);
    console.log('[IntelligentSearch] ✅ Intent understanding complete');

    if (intentResult.error) {
      console.warn('[IntelligentSearch] Intent understanding failed, using simple search:', intentResult.error);
    }

    let intent = intentResult.data || {
      primaryQuery: userQuery,
      expandedQueries: [userQuery],
      categories: [],
      brands: [],
      itemTypes: [],
      extractedItems: [{ name: userQuery, searchTerms: [userQuery], quantity: 1 }],
      reasoning: 'Fallback: Using default intent',
    };
    
    // Post-process: Ensure quantities are valid (never 0, default to 1 if missing)
    if (intent.extractedItems) {
      intent.extractedItems = intent.extractedItems.map((item: any) => {
        // If quantity is 0, undefined, null, or negative, default to 1
        if (!item.quantity || item.quantity <= 0 || isNaN(item.quantity)) {
          item.quantity = 1;
        }
        return item;
      });
    }

    console.log('\n[IntelligentSearch] 💭 LLM REASONING (see UI thinking stream for full text):');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log(intent.reasoning.substring(0, 100) + (intent.reasoning.length > 100 ? '...' : ''));
    console.log('─────────────────────────────────────────────────────────────────');
    console.log(`\n[IntelligentSearch] 📊 EXTRACTED INTENT:`);
    console.log(`  • Primary Query: "${intent.primaryQuery}"`);
    console.log(`  • Expanded Queries (${intent.expandedQueries.length}):`, intent.expandedQueries);
    console.log(`  • Categories (${intent.categories.length}):`, intent.categories);
    console.log(`  • Brands (${intent.brands.length}):`, intent.brands);
    console.log(`  • Item Types (${intent.itemTypes.length}):`, intent.itemTypes);
    console.log(`  • Extracted Items (${intent.extractedItems.length}):`);
    intent.extractedItems.forEach((item, i) => {
      console.log(`    ${i + 1}. ${item.name} (${item.brand || 'no brand'}) - Category: ${item.category || 'N/A'}`);
      console.log(`       Search terms: ${item.searchTerms.join(', ')}`);
    });

    // Step 4: Search items using semantic search with expanded queries
    console.log('\n[IntelligentSearch] 🔍 STEP 4: Semantic search with expanded queries...');
    const allMatchingItems: SearchItemResultWithShop[] = [];
    const itemMap = new Map<string, SearchItemResultWithShop>(); // Deduplicate by item ID

    // Search with each expanded query
    for (const query of intent.expandedQueries) {
      console.log(`\n[IntelligentSearch]   🔎 Searching for: "${query}"`);
      const searchResult = await searchItemsAcrossShops(shopIds, query, {
        limit: options?.itemsPerShop ? options.itemsPerShop * shopIds.length : 50,
        minSimilarity: options?.minSimilarity ?? 0.5, // Lower threshold for better recall
      });

      if (searchResult.data) {
        console.log(`[IntelligentSearch]   ✅ Vector search returned ${searchResult.data.length} items`);
        searchResult.data.forEach((item) => {
          // Keep item with highest similarity if duplicate
          const existing = itemMap.get(item.merchant_item_id);
          if (!existing || item.similarity > existing.similarity) {
            itemMap.set(item.merchant_item_id, item);
          }
        });
      } else {
        console.log(`[IntelligentSearch]   ⚠️  Vector search returned no results`);
      }
    }
    console.log(`[IntelligentSearch] ✅ Semantic search complete: ${itemMap.size} unique items found`);

    // Step 5: Build shop name map for category search
    const shopNameMap = new Map<string, string>();
    topShops.forEach((shop) => {
      shopNameMap.set(shop.id, shop.name);
    });

    // Step 6: Also search by categories if specified
    if (intent.categories.length > 0 || intent.itemTypes.length > 0) {
      console.log('\n[IntelligentSearch] 📂 STEP 5: Category-based search...');
      console.log(`[IntelligentSearch]   Categories: ${intent.categories.join(', ')}`);
      console.log(`[IntelligentSearch]   Item Types: ${intent.itemTypes.join(', ')}`);
      
      const categoryItems = await searchItemsByCategories(
        shopIds,
        intent.categories,
        intent.itemTypes,
        shopNameMap
      );

      console.log(`[IntelligentSearch] ✅ Category search returned ${categoryItems.length} items`);
      
      categoryItems.forEach((item) => {
        const existing = itemMap.get(item.merchant_item_id);
        if (!existing || item.similarity > existing.similarity) {
          itemMap.set(item.merchant_item_id, item);
        }
      });
      console.log(`[IntelligentSearch] ✅ Total unique items after category search: ${itemMap.size}`);
    } else {
      console.log('\n[IntelligentSearch] ⏭️  STEP 5: Skipping category search (no categories identified)');
    }

    // Step 6: Update shop names for category-matched items and group by shop
    console.log('\n[IntelligentSearch] 📊 STEP 6: Grouping items by shop and calculating relevance...');
    const shopItemsMap = new Map<string, SearchItemResultWithShop[]>();
    const shopCategoryMap = new Map<string, Set<string>>();

    // Update shop names for category items and group
    Array.from(itemMap.values()).forEach((item) => {
      // Update shop name if we have it
      if (shopNameMap.has(item.shop_id)) {
        item.shop_name = shopNameMap.get(item.shop_id)!;
      }

      const existing = shopItemsMap.get(item.shop_id) || [];
      existing.push(item);
      shopItemsMap.set(item.shop_id, existing);

      // Track which categories matched for this shop
      if (!shopCategoryMap.has(item.shop_id)) {
        shopCategoryMap.set(item.shop_id, new Set());
      }
      intent.categories.forEach((cat) => {
        shopCategoryMap.get(item.shop_id)!.add(cat);
      });
    });

    // Step 7: Build results with relevance scoring
    console.log('\n[IntelligentSearch] 🎯 STEP 7: Building results with relevance scoring...');
    const results: IntelligentSearchResult[] = topShops.map((shop) => {
      const matchingItems = shopItemsMap.get(shop.id) || [];
      const matchedCategories = Array.from(shopCategoryMap.get(shop.id) || []);

      // Calculate relevance score
      const avgSimilarity =
        matchingItems.length > 0
          ? matchingItems.reduce((sum, item) => sum + item.similarity, 0) / matchingItems.length
          : 0;

      const deliveryFeeScore = shop.delivery_fee
        ? Math.max(0, 1 - shop.delivery_fee / 200) // Normalize to 0-1
        : 0.5;

      const itemCountScore = Math.min(1, matchingItems.length / 10); // More items = better

      const relevanceScore =
        matchingItems.length > 0
          ? 0.3 * itemCountScore + 0.4 * avgSimilarity + 0.3 * deliveryFeeScore
          : 0.1 * deliveryFeeScore;

      return {
        shop,
        matchingItems: matchingItems
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, options?.itemsPerShop ?? 10),
        categoryMatches: matchedCategories,
        relevanceScore,
      };
    });

    // Sort by relevance
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Filter out shops with no items (unless all shops have no items)
    const shopsWithItems = results.filter((r) => r.matchingItems.length > 0);
    const finalResults = shopsWithItems.length > 0 ? shopsWithItems : results;

    console.log('\n[IntelligentSearch] 🎉 FINAL RESULTS:');
    console.log('=================================================================');
    console.log(`📊 Total shops with items: ${finalResults.length}`);
    finalResults.forEach((result, i) => {
      const relevancePercent = (result.relevanceScore * 100).toFixed(1);
      console.log(`\n${i + 1}. ${result.shop.name} - Relevance: ${relevancePercent}%`);
      console.log(`   Delivery Fee: PKR ${result.shop.delivery_fee?.toFixed(2) || 'N/A'}`);
      console.log(`   Matching Items: ${result.matchingItems.length}`);
      if (result.matchingItems.length > 0) {
        console.log(`   Top Items:`);
        result.matchingItems.slice(0, 3).forEach((item, j) => {
          const pricePKR = (item.price_cents / 100).toFixed(2);
          const similarityPercent = (item.similarity * 100).toFixed(1);
          console.log(`     ${j + 1}. ${item.item_name} - PKR ${pricePKR} (${similarityPercent}% match)`);
        });
      }
    });
    console.log('=================================================================\n');

    return { 
      data: {
        results: finalResults,
        reasoning: intent.reasoning,
        intent: intent,
      }, 
      error: null 
    };
  } catch (error: any) {
    console.error('[IntelligentSearch] Exception in intelligent search:', error);
    return { data: null, error: error?.message || 'Unknown error occurred' };
  }
}

/**
 * Format intelligent search results for LLM context
 */
export function formatIntelligentSearchResultsForLLM(
  response: IntelligentSearchResponse
): string {
  const results = response.results;
  if (results.length === 0) {
    return 'No shops or items found matching your query.';
  }

  // Create a map of item names to quantities from extractedItems
  const quantityMap = new Map<string, number>();
  if (response.intent?.extractedItems) {
    response.intent.extractedItems.forEach((extractedItem) => {
      // Map by item name (normalized) and brand
      const key = extractedItem.brand 
        ? `${extractedItem.brand.toLowerCase()}` 
        : extractedItem.name.toLowerCase();
      if (extractedItem.quantity) {
        quantityMap.set(key, extractedItem.quantity);
      }
    });
  }

  const formatted = results.map((result, index) => {
    const deliveryFeePKR = (result.shop.delivery_fee || 0).toFixed(2);
    const relevancePercent = (result.relevanceScore * 100).toFixed(0);

    let shopInfo = `${index + 1}. ${result.shop.name}`;
    shopInfo += ` - Delivery: PKR ${deliveryFeePKR}`;
    shopInfo += ` - Relevance: ${relevancePercent}%`;

    if (result.categoryMatches.length > 0) {
      shopInfo += ` - Categories: ${result.categoryMatches.join(', ')}`;
    }

    if (result.matchingItems.length > 0) {
      shopInfo += `\n   Found ${result.matchingItems.length} matching items:`;
      result.matchingItems.slice(0, 5).forEach((item) => {
        const pricePKR = (item.price_cents / 100).toFixed(2);
        const similarityPercent = (item.similarity * 100).toFixed(0);
        
        // Try to find matching quantity from extracted items
        const itemNameLower = item.item_name.toLowerCase();
        let suggestedQuantity = 1;
        for (const [key, qty] of quantityMap.entries()) {
          if (itemNameLower.includes(key) || key.includes(itemNameLower.split(' ')[0])) {
            suggestedQuantity = qty;
            break;
          }
        }
        
        const quantityHint = suggestedQuantity > 1 ? ` (suggested quantity: ${suggestedQuantity})` : '';
        shopInfo += `\n   - ${item.item_name} (PKR ${pricePKR}, ${similarityPercent}% match) [ID: ${item.merchant_item_id}]${quantityHint}`;
      });
      if (result.matchingItems.length > 5) {
        shopInfo += `\n   ... and ${result.matchingItems.length - 5} more items`;
      }
    } else {
      shopInfo += '\n   No matching items found';
    }

    return shopInfo;
  });

  // Add quantity reminder if quantities were extracted
  let quantityNote = '';
  if (response.intent?.extractedItems && response.intent.extractedItems.some(item => item.quantity && item.quantity > 1)) {
    const itemsWithQuantities = response.intent.extractedItems
      .filter(item => item.quantity && item.quantity > 1)
      .map(item => `${item.name} (${item.quantity})`)
      .join(', ');
    quantityNote = `\n\nIMPORTANT: User requested specific quantities: ${itemsWithQuantities}. When adding items to cart, use these quantities.`;
  }

  return `Search Results:\n${formatted.join('\n\n')}${quantityNote}`;
}

