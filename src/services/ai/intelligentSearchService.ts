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
import { calculateDistance, fetchDeliveryLogic, fetchDeliveryLogicBatch, calculateTotalDeliveryFee } from '../merchant/deliveryLogicService';

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

export type SearchStepStatus = 'pending' | 'active' | 'completed' | 'error';

export interface SearchStep {
  id: string;
  label: string;
  status: SearchStepStatus;
  details?: any;
}

export interface SearchProgress {
  steps: SearchStep[];
  currentStepId: string | null;
  intent?: {
    primaryQuery: string;
    expandedQueries: string[];
  };
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
    onProgress?: (progress: SearchProgress) => void;
  }
): Promise<ServiceResult<IntelligentSearchResponse>> {
  console.log('\n=================================================================');
  console.log('[IntelligentSearch] 🚀 STARTING INTELLIGENT SEARCH');
  console.log('=================================================================');
  console.log(`📝 User Query: "${userQuery}"`);
  console.log(`📍 Location: ${latitude}, ${longitude}`);
  console.log(`⚙️  Options:`, options);
  console.log('=================================================================\n');

  // Initialize progress state
  const steps: SearchStep[] = [
    { id: 'understand_intent', label: 'Thinking...', status: 'pending' },
    { id: 'find_shops', label: 'Finding nearby shops', status: 'pending' },
    { id: 'semantic_search', label: 'Searching for items', status: 'pending' },
    { id: 'expanding_search', label: 'Expanding search...', status: 'pending' },
    { id: 'ranking', label: 'Ranking results', status: 'pending' },
  ];

  const updateProgress = (stepId: string, status: SearchStepStatus, details?: any) => {
    if (!options?.onProgress) return;

    const stepIndex = steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) return;

    // Update current step
    steps[stepIndex] = { ...steps[stepIndex], status, details };

    // Mark previous steps as completed if we're moving forward
    if (status === 'active') {
      for (let i = 0; i < stepIndex; i++) {
        if (steps[i].status !== 'completed') {
          steps[i].status = 'completed';
        }
      }
    }

    options.onProgress({
      steps: [...steps],
      currentStepId: status === 'active' ? stepId : null,
      // We'll update this later when we have the intent
    });
  };

  // Helper to update progress with intent
  const updateProgressWithIntent = (stepId: string, status: SearchStepStatus, intentData: SearchIntent, details?: any) => {
    if (!options?.onProgress) return;

    const stepIndex = steps.findIndex(s => s.id === stepId);
    if (stepIndex !== -1) {
      steps[stepIndex] = { ...steps[stepIndex], status, details };
    }

    if (status === 'active') {
      for (let i = 0; i < stepIndex; i++) {
        if (steps[i].status !== 'completed') {
          steps[i].status = 'completed';
        }
      }
    }

    options.onProgress({
      steps: [...steps],
      currentStepId: status === 'active' ? stepId : null,
      intent: {
        primaryQuery: intentData.primaryQuery,
        expandedQueries: intentData.expandedQueries
      }
    });
  };

  try {
    // Step 0: Understand intent (moved first as per user request "start with thinking label")
    console.log('\n[IntelligentSearch] 🧠 STEP 0: Understanding search intent with LLM...');
    updateProgress('understand_intent', 'active');

    // We need available categories for intent understanding, but we can fetch them in parallel or after shops
    // For now, let's just do intent understanding first with empty categories if needed, 
    // or we can re-order. The user wants "Thinking" first.
    // Let's fetch shops first but only show "Thinking" in UI until we have intent?
    // No, "Finding shops" is a physical action.
    // User said: "start with thinking label showing llm reasonuing"

    // Let's do intent understanding first.
    const intentResult = await understandSearchIntent(userQuery, []); // Pass empty categories for now
    console.log('[IntelligentSearch] ✅ Intent understanding complete');

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

    updateProgressWithIntent('understand_intent', 'completed', intent, {
      reasoning: intent.reasoning,
      extracted: intent.extractedItems.map(i => `${i.name} (Qty: ${i.quantity || 1})`).join(', '),
      extractedItems: intent.extractedItems.map(item => ({
        name: item.name,
        brand: item.brand,
        category: item.category,
        quantity: item.quantity || 1,
        searchTerms: item.searchTerms
      }))
    });

    // Step 1: Find shops in user's area
    console.log('[IntelligentSearch] 📍 STEP 1: Finding shops by location...');
    updateProgress('find_shops', 'active');

    const shopsResult = await findShopsByLocation(latitude, longitude);
    console.log(`[IntelligentSearch] ✅ Found ${shopsResult.data?.length || 0} shops in area`);

    if (shopsResult.error || !shopsResult.data) {
      updateProgress('find_shops', 'error', { error: shopsResult.error?.message });
      return {
        data: null,
        error: shopsResult.error?.message || 'Failed to find shops',
      };
    }

    const shops = shopsResult.data;
    const maxShops = options?.maxShops ?? 10; // Search more shops for better coverage
    const topShops = shops.slice(0, maxShops);
    const shopIds = topShops.map((shop) => shop.id);

    updateProgress('find_shops', 'completed', {
      found: `${topShops.length} shop${topShops.length !== 1 ? 's' : ''} in area`,
      shops: topShops.map((shop) => ({
        id: shop.id,
        name: shop.name,
      }))
    });

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

    // Removed duplicate Step 2 & 3 blocks since we moved intent understanding to start
    // We still need to fetch categories for context if we want to use them in future, 
    // but for now we can skip or do it silently.

    // Step 2: Get available categories (silently or as part of finding shops)
    // We'll skip the progress update for this to keep UI clean as per user request
    const availableCategories = await getAvailableCategories(shopIds);

    console.log(`[IntelligentSearch] ✅ Found ${availableCategories.length} unique categories:`, availableCategories.join(', '));

    // Step 3: Use LLM to understand intent and expand query (already done as Step 0)
    // We can now re-run intent understanding with available categories if needed,
    // or just use the initial intent and enrich it. For now, we'll stick to the initial intent.
    // If we want to use categories for intent, we'd move intent understanding after category fetching.
    // For this change, we're keeping intent understanding first as per instruction.

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
    console.log('\n[IntelligentSearch] 🔍 STEP 2: Semantic search with expanded queries...');

    // Format label to show what we are searching for
    const searchLabel = intent.extractedItems.length > 0
      ? `Searching for ${intent.extractedItems.map(i => `"${i.name}"`).join(', ')}...`
      : 'Searching for items...';

    // Update label dynamically
    const semanticStepIndex = steps.findIndex(s => s.id === 'semantic_search');
    if (semanticStepIndex !== -1) {
      steps[semanticStepIndex].label = searchLabel;
      // Update the step in the array so it's reflected in progress
      steps[semanticStepIndex] = { ...steps[semanticStepIndex], label: searchLabel };
    }

    // Update progress with primary query, expanded queries, and extracted items
    updateProgressWithIntent('semantic_search', 'active', intent, {
      primaryQuery: intent.primaryQuery,
      expandedQueries: intent.expandedQueries,
      extractedItems: intent.extractedItems.map(item => ({
        name: item.name,
        brand: item.brand,
        category: item.category,
        quantity: item.quantity || 1,
        searchTerms: item.searchTerms
      }))
    });

    const allMatchingItems: SearchItemResultWithShop[] = [];
    const itemMap = new Map<string, SearchItemResultWithShop>(); // Deduplicate by item ID

    // OPTIMIZATION 1: Parallelize vector search queries using Promise.all
    // Instead of searching sequentially, fire all queries simultaneously
    console.log(`\n[IntelligentSearch]   🔎 Searching ${intent.expandedQueries.length} expanded queries in parallel...`);
    const searchPromises = intent.expandedQueries.map(async (query) => {
      console.log(`[IntelligentSearch]   🔎 Searching for: "${query}"`);
      const searchResult = await searchItemsAcrossShops(shopIds, query, {
        limit: options?.itemsPerShop ? options.itemsPerShop * shopIds.length : 50,
        minSimilarity: options?.minSimilarity ?? 0.5, // Lower threshold for better recall
      });

      return { query, searchResult };
    });

    // Wait for all searches to complete in parallel
    const searchResults = await Promise.all(searchPromises);

    // Process all results
    searchResults.forEach(({ query, searchResult }) => {
      if (searchResult.data) {
        console.log(`[IntelligentSearch]   ✅ Vector search for "${query}" returned ${searchResult.data.length} items`);
        searchResult.data.forEach((item) => {
          // Keep item with highest similarity if duplicate
          const existing = itemMap.get(item.merchant_item_id);
          if (!existing || item.similarity > existing.similarity) {
            itemMap.set(item.merchant_item_id, item);
          }
        });
      } else {
        console.log(`[IntelligentSearch]   ⚠️  Vector search for "${query}" returned no results`);
      }
    });
    console.log(`[IntelligentSearch] ✅ Semantic search complete: ${itemMap.size} unique items found`);

    // Mark semantic search as completed
    updateProgressWithIntent('semantic_search', 'completed', intent, {
      primaryQuery: intent.primaryQuery,
      expandedQueries: intent.expandedQueries,
      extractedItems: intent.extractedItems.map(item => ({
        name: item.name,
        brand: item.brand,
        category: item.category,
        quantity: item.quantity || 1,
        searchTerms: item.searchTerms
      }))
    });

    // Now show "Expanding search..." step with unified results
    const unifiedResults = Array.from(itemMap.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 20) // Top 20 items
      .map(item => ({
        name: item.item_name,
        price: item.price_cents ? `PKR ${(item.price_cents / 100).toFixed(2)}` : 'N/A',
        shop: item.shop_name || 'Unknown Shop',
        similarity: Math.round(item.similarity * 100)
      }));

    updateProgress('expanding_search', 'active', {
      totalFound: itemMap.size,
      results: unifiedResults
    });

    // Step 5: Build shop name map for category search
    const shopNameMap = new Map<string, string>();
    topShops.forEach((shop) => {
      shopNameMap.set(shop.id, shop.name);
    });

    // Step 6: Also search by categories if specified
    // We can skip explicit category search visualization if it's too technical, 
    // or merge it into "Searching for items"
    if (intent.categories.length > 0 || intent.itemTypes.length > 0) {
      console.log('\n[IntelligentSearch] 📂 STEP 3: Category-based search...');
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
      console.log('\n[IntelligentSearch] ⏭️  STEP 3: Skipping category search (no categories identified)');
    }

    // Update expanding search step with final unified results
    const finalUnifiedResults = Array.from(itemMap.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 20) // Top 20 items
      .map(item => ({
        name: item.item_name,
        price: item.price_cents ? `PKR ${(item.price_cents / 100).toFixed(2)}` : 'N/A',
        shop: item.shop_name || 'Unknown Shop',
        similarity: Math.round(item.similarity * 100)
      }));

    updateProgress('expanding_search', 'completed', {
      totalFound: itemMap.size,
      results: finalUnifiedResults
    });

    // Step 6: Update shop names for category-matched items and group by shop
    console.log('\n[IntelligentSearch] 📊 STEP 4: Grouping items by shop and calculating relevance...');
    updateProgress('ranking', 'active');

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

    // Step 7: Calculate delivery fees for each shop
    console.log('\n[IntelligentSearch] 🎯 STEP 7: Calculating delivery fees and building results with relevance scoring...');
    
    // OPTIMIZATION 2: Retrieve user preferences for personalized ranking
    // Boost items that match user's past purchase history
    let userPreferences: Array<{ entity_name: string; similarity: number; preference_value: string }> = [];
    try {
      // Retrieve preferences based on the search query and extracted items
      const preferenceQueries = [
        intent.primaryQuery,
        ...intent.extractedItems.map(item => item.name),
        ...intent.brands,
      ].filter(Boolean);

      if (preferenceQueries.length > 0) {
        // Use the primary query to find relevant preferences
        const preferenceResult = await retrievePreferencesBySimilarity(intent.primaryQuery, {
          limit: 10,
          minSimilarity: 0.7,
        });

        if (preferenceResult.data && preferenceResult.data.length > 0) {
          userPreferences = preferenceResult.data.map(pref => ({
            entity_name: pref.entity_name.toLowerCase(),
            similarity: pref.similarity,
            preference_value: pref.preference_value,
          }));
          console.log(`[IntelligentSearch] ✅ Retrieved ${userPreferences.length} user preferences for personalization`);
        }
      }
    } catch (error) {
      console.warn('[IntelligentSearch] Failed to retrieve user preferences (non-critical):', error);
      // Continue without preferences - this is not a critical failure
    }

    // OPTIMIZATION 3: Batch fetch all delivery logic in a single query
    // Instead of N individual DB calls, fetch all at once
    const deliveryLogicMap = await fetchDeliveryLogicBatch(shopIds);
    console.log(`[IntelligentSearch] ✅ Batch fetched delivery logic for ${deliveryLogicMap.size} shops`);

    // Apply preference-based boosting to item similarity scores
    // Items matching user preferences get a 10% boost to their similarity score
    if (userPreferences.length > 0) {
      console.log(`[IntelligentSearch] 🎯 Applying preference-based boosting to ${itemMap.size} items...`);
      Array.from(itemMap.values()).forEach((item) => {
        const itemNameLower = item.item_name.toLowerCase();
        const itemDescriptionLower = (item.item_description || '').toLowerCase();

        // Check if item matches any user preference
        for (const pref of userPreferences) {
          const matchesName = itemNameLower.includes(pref.entity_name) || pref.entity_name.includes(itemNameLower);
          const matchesDescription = itemDescriptionLower.includes(pref.entity_name);

          if (matchesName || matchesDescription) {
            // Only boost if user prefers (not avoids or is allergic to)
            if (pref.preference_value === 'prefers') {
              const boost = 0.1 * pref.similarity; // 10% boost weighted by preference confidence
              item.similarity = Math.min(1.0, item.similarity + boost);
              console.log(`[IntelligentSearch]   ⬆️  Boosted "${item.item_name}" by ${(boost * 100).toFixed(1)}% (matches preference: ${pref.entity_name})`);
            }
            break; // Only apply one boost per item (highest preference match)
          }
        }
      });
    }

    // Calculate delivery fees for all shops in parallel
    const shopDeliveryFees = new Map<string, number>();
    const deliveryFeePromises = topShops.map(async (shop) => {
      if (!shop.latitude || !shop.longitude) {
        shopDeliveryFees.set(shop.id, 0);
        return;
      }

      try {
        // Calculate distance from user location to shop
        const distance = calculateDistance(
          latitude,
          longitude,
          shop.latitude,
          shop.longitude
        );

        // Get delivery logic from batch-fetched map (no additional DB call)
        const deliveryLogic = deliveryLogicMap.get(shop.id);
        
        if (!deliveryLogic) {
          shopDeliveryFees.set(shop.id, 0);
          return;
        }

        // Calculate base delivery fee using a sample order value of 0 PKR
        // This gives us the base delivery fee without surcharge or free delivery considerations
        // (since we don't know the actual cart value at search time)
        const calculation = calculateTotalDeliveryFee(0, distance, deliveryLogic);
        
        // Store the base delivery fee (in PKR, not cents)
        shopDeliveryFees.set(shop.id, calculation.baseFee);
      } catch (error) {
        console.error(`[IntelligentSearch] Failed to calculate delivery fee for shop ${shop.id}:`, error);
        shopDeliveryFees.set(shop.id, 0);
      }
    });

    // Wait for all delivery fee calculations to complete
    await Promise.all(deliveryFeePromises);

    // Build results with relevance scoring
    // Note: Item similarity scores may have been boosted by preferences above
    const results: IntelligentSearchResult[] = topShops.map((shop) => {
      const matchingItems = shopItemsMap.get(shop.id) || [];
      const matchedCategories = Array.from(shopCategoryMap.get(shop.id) || []);

      // Re-sort items by boosted similarity scores
      const sortedItems = matchingItems
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, options?.itemsPerShop ?? 10);

      // Get calculated delivery fee
      const calculatedDeliveryFee = shopDeliveryFees.get(shop.id) || 0;

      // Calculate relevance score using boosted similarity scores
      const avgSimilarity =
        sortedItems.length > 0
          ? sortedItems.reduce((sum, item) => sum + item.similarity, 0) / sortedItems.length
          : 0;

      // Use calculated delivery fee for scoring (normalize to 0-1, lower fee = higher score)
      const deliveryFeeScore = calculatedDeliveryFee > 0
        ? Math.max(0, 1 - calculatedDeliveryFee / 200) // Normalize to 0-1, assuming max fee around 200 PKR
        : 0.5; // Default score if fee is 0 (free delivery or unknown)

      const itemCountScore = Math.min(1, matchingItems.length / 10); // More items = better

      const relevanceScore =
        matchingItems.length > 0
          ? 0.3 * itemCountScore + 0.4 * avgSimilarity + 0.3 * deliveryFeeScore
          : 0.1 * deliveryFeeScore;

      // Create a shop object with the calculated delivery fee
      const shopWithDeliveryFee: ConsumerShop = {
        ...shop,
        delivery_fee: calculatedDeliveryFee,
      };

      return {
        shop: shopWithDeliveryFee,
        matchingItems: sortedItems, // Already sorted and sliced above
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
      const deliveryFee = result.shop.delivery_fee ?? 0;
      console.log(`\n${i + 1}. ${result.shop.name} - Relevance: ${relevancePercent}%`);
      console.log(`   Delivery Fee: PKR ${deliveryFee.toFixed(2)}`);
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

    updateProgress('ranking', 'completed', {
      totalResults: finalResults.length,
      topShop: finalResults[0]?.shop.name,
      shops: finalResults.map((result) => ({
        id: result.shop.id,
        name: result.shop.name,
        shopName: result.shop.name,
        relevance: result.relevanceScore > 1 
          ? Math.round(result.relevanceScore * 10) / 10 
          : Math.round(result.relevanceScore * 100 * 10) / 10,
        relevanceScore: result.relevanceScore,
        matchingItems: result.matchingItems.length,
        topItems: result.matchingItems.slice(0, 3).map((item) => ({
          name: item.item_name,
          price_cents: item.price_cents,
          similarity: item.similarity
        }))
      }))
    });

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
    const deliveryFee = result.shop.delivery_fee ?? 0;
    const deliveryFeePKR = deliveryFee.toFixed(2);
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
