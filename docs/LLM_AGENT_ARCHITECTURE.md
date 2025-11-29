# LLM Agent Architecture

## Overview
This document describes the architecture of the intelligent shopping assistant LLM agent, from user input to order placement.

---

## High-Level Flow

```
User Input → Intent Understanding → Multi-Shop Search → Item Selection → Cart Management → Order Placement
```

---

## Component Architecture

### 1. User Input & Interface Layer

**File:** `src/components/conversational/ConversationalInterface.tsx`

**Responsibilities:**
- Receives user text/voice input
- Manages conversation UI (message bubbles, input field)
- Orchestrates the function call loop
- Handles sequential function calls (multiple searches → add to cart → place order)

**Key Flow:**
- User types message → `handleSendMessage()`
- Retrieves user preferences for context
- Sends message to conversation manager
- Loops through function calls until LLM returns final response

---

### 2. Conversation Management Layer

**File:** `src/context/ConversationContext.tsx`

**Responsibilities:**
- Manages conversation state and message history
- Provides conversation manager instance
- Updates message state after each interaction
- Exposes `refreshMessages()` for manual updates

**File:** `src/services/ai/conversationManager.ts`

**Responsibilities:**
- Maintains message history (system, user, assistant)
- Formats messages for OpenAI API
- Handles function call detection
- Manages conversation state persistence

**Key Methods:**
- `sendMessage()` - Sends message to LLM, returns response or function call
- `addFunctionResult()` - Adds function execution result to conversation
- `getOpenAIMessages()` - Formats messages for OpenAI API

---

### 3. Intent Understanding & Query Expansion

**File:** `src/services/ai/intelligentSearchService.ts`

**Function:** `understandSearchIntent()`

**Responsibilities:**
- Uses LLM to understand user intent from natural language
- Expands queries intelligently:
  - Brand variations: "lays" → ["Lay's", "lays", "Lays chips", "potato chips"]
  - Category synonyms: "chips" → ["Munchies" category]
  - Item types: "cold drink" → ["Cold Drinks & Juices" category]
- Returns structured intent with:
  - `primaryQuery`: Main search query
  - `expandedQueries`: Array of search variations
  - `categories`: Category names to search
  - `brands`: Brand names mentioned
  - `itemTypes`: General item types

**LLM Prompt Context:**
- Pakistani FMCG market context
- Available shop categories
- Brand name normalization rules

---

### 4. Multi-Shop Search Execution

**File:** `src/services/ai/intelligentSearchService.ts`

**Function:** `intelligentSearch()`

**Step-by-Step Process:**

1. **Find Shops in Area**
   - Calls: `findShopsByLocation()` from `src/services/consumer/shopService.ts`
   - Gets all shops with delivery areas containing user's location

2. **Get Available Categories**
   - Calls: `getAvailableCategories()` (internal)
   - Fetches categories from all shops using `fetchShopCategories()`
   - Provides context to LLM for category matching

3. **Understand Intent** (see section 3)

4. **Semantic Item Search**
   - For each expanded query:
     - Calls: `searchItemsAcrossShops()` from `src/services/ai/inventorySearchRAG.ts`
     - Uses vector embeddings for semantic similarity
     - Searches across all shops simultaneously
   - Deduplicates items (keeps highest similarity score)

5. **Category-Based Search**
   - Calls: `searchItemsByCategories()` (internal)
   - Matches category names (e.g., "Munchies" contains "chips")
   - Fetches items from matching categories using `fetchShopItems()`
   - Adds items with category match similarity score (0.7)

6. **Result Aggregation**
   - Combines semantic search results + category search results
   - Groups items by shop
   - Calculates relevance scores (item count, similarity, delivery fee)
   - Sorts by relevance

7. **Format for LLM**
   - Calls: `formatIntelligentSearchResultsForLLM()`
   - Creates human-readable summary with item IDs
   - Includes shop info, prices, similarity scores

---

### 5. Semantic Search Engine

**File:** `src/services/ai/inventorySearchRAG.ts`

**Key Functions:**

- `searchItemsAcrossShops()`:
  - Generates embedding for query using `embeddingService.ts`
  - Calls database function: `search_items_across_shops_by_similarity`
  - Uses pgvector HNSW index for fast similarity search
  - Returns items with similarity scores (0.0-1.0)

- `searchItemsInShop()`:
  - Single-shop semantic search
  - Falls back to text search if embeddings fail
  - Used by `searchItemsInShop` function schema

**Database Support:**
- Migration: `supabase/migrations/047_create_inventory_embeddings.sql`
- Stores 1536-dimensional embeddings (OpenAI text-embedding-3-small)
- HNSW index for fast approximate nearest neighbor search

**File:** `src/services/ai/embeddingService.ts`
- Generates embeddings using OpenAI API
- Handles batch processing
- Caches embeddings

---

### 6. Function Routing & Execution

**File:** `src/services/ai/functionRouter.ts`

**Function:** `executeFunctionCall()`

**Supported Functions:**

1. **`intelligentSearch`**
   - Calls: `intelligentSearch()` from `intelligentSearchService.ts`
   - Returns shops with matching items, formatted for LLM

2. **`addItemsToCart`** (Batch)
   - Executes: `executeAddItemsToCart()`
   - For each item:
     - Gets item details via `getItemDetailsFn`
     - Validates stock via `validateItemStock()`
     - Gets shop details via `getShopDetailsFn`
     - Adds to cart via `addItemToCartFn` from CartContext
     - Updates quantity if needed
   - Returns summary of added items

3. **`addItemToCart`** (Single)
   - Similar to batch, but for one item

4. **`removeItemFromCart`**
   - Removes item or reduces quantity

5. **`updateItemQuantity`**
   - Updates item quantity in cart

6. **`getCart`**
   - Returns current cart for a shop

7. **`getAllCarts`**
   - Returns all carts across shops

8. **`placeOrder`**
   - Validates cart is not empty
   - Gets default address if not provided
   - Calls: `placeOrder()` from `src/services/consumer/orderService.ts`
   - Returns order details

**File:** `src/services/ai/functionSchemas.ts`
- Defines all available functions for OpenAI
- Describes parameters and return types
- Guides LLM on when to use each function

---

### 7. Cart Management

**File:** `src/context/CartContext.tsx`

**Responsibilities:**
- Per-shop cart management
- AsyncStorage persistence
- Automatic total calculations
- Cart operations (add, remove, update quantity)

**Key Functions:**
- `addItemToCart()` - Adds item or increments quantity
- `removeItemFromCart()` - Removes item or decrements quantity
- `updateItemQuantity()` - Sets specific quantity
- `getShopCart()` - Gets cart for specific shop
- `getAllCarts()` - Gets all carts

**Data Structure:**
```typescript
{
  [shopId: string]: {
    shopId, shopName, shopImage, shopAddress,
    items: [{ id, name, price_cents, quantity }],
    totalPrice, totalItems
  }
}
```

---

### 8. Order Placement

**File:** `src/services/consumer/orderService.ts`

**Function:** `placeOrder()`

**Process:**
1. Validates cart items
2. Calculates order totals (subtotal, delivery fee, surcharge)
3. Validates minimum order value
4. Creates order record in database
5. Creates order items
6. Updates order status
7. Returns order confirmation

**Database Tables:**
- `orders` - Order records
- `order_items` - Individual items in order
- Migrations: `supabase/migrations/20231112000001_create_orders_system.sql`

---

## Complete Flow Example: "Order 2 chips and one cold drink"

### Step 1: User Input
- **File:** `ConversationalInterface.tsx` → `handleSendMessage()`
- User types: "order 2 chips and one cold drink"
- Retrieves user preferences (if any)

### Step 2: Intent Understanding
- **File:** `intelligentSearchService.ts` → `understandSearchIntent()`
- LLM analyzes: "2 chips" and "one cold drink"
- Expands:
  - Chips: ["chips", "Lay's", "snacks", "Munchies" category]
  - Cold drink: ["cold drink", "soft drink", "Cold Drinks & Juices" category]

### Step 3: First Search (Chips)
- **File:** `intelligentSearchService.ts` → `intelligentSearch("chips")`
- Finds shops in user's area
- Searches items semantically using embeddings
- Searches "Munchies" category
- Returns matching items with IDs and shop IDs

### Step 4: Second Search (Cold Drink)
- **File:** `intelligentSearchService.ts` → `intelligentSearch("cold drink")`
- Same process as Step 3
- Returns cold drink items

### Step 5: LLM Processes Results
- **File:** `conversationManager.ts`
- LLM receives both search results
- Decides which items to add based on user request ("2 chips", "one cold drink")
- Selects specific items with quantities

### Step 6: Add Items to Cart
- **File:** `functionRouter.ts` → `executeAddItemsToCart()`
- For each selected item:
  - Gets item details from `fetchShopItems()`
  - Validates stock
  - Adds to cart via `CartContext.addItemToCart()`
- Returns summary

### Step 7: Show Cart
- **File:** `functionRouter.ts` → `executeGetCart()`
- LLM calls `getCart` to show user what's in cart
- User confirms

### Step 8: Place Order
- **File:** `functionRouter.ts` → `executePlaceOrder()`
- Gets default address
- Calls `orderService.placeOrder()`
- Creates order in database
- Returns order confirmation

---

## Supporting Systems

### User Preferences & Memory

**File:** `src/services/ai/memoryRetrievalService.ts`

**Purpose:**
- Retrieves user preferences using vector similarity
- Used to personalize search results
- Called in `ConversationalInterface` before sending message

**Database:**
- Migration: `supabase/migrations/046_create_preference_memory_system.sql`
- Tables: `user_preferences`, `user_preference_embeddings`
- Function: `search_user_preferences_by_similarity`

### Embedding Generation

**File:** `src/services/ai/embeddingService.ts`

**Purpose:**
- Generates embeddings for queries and items
- Uses OpenAI text-embedding-3-small model
- Supports batch processing

**File:** `src/services/ai/openAIService.ts`
- Low-level OpenAI API client
- Handles chat completions and embeddings

### Stock Validation

**File:** `src/services/consumer/stockValidationService.ts`

**Function:** `validateItemStock()`
- Validates item availability before adding to cart
- Called by `functionRouter` before cart operations

---

## Database Schema

### Item Embeddings
- **Table:** `merchant_item_embeddings`
- **Migration:** `047_create_inventory_embeddings.sql`
- Stores vector embeddings for semantic search
- Indexed with HNSW for fast similarity search

### User Preferences
- **Tables:** `user_preferences`, `user_preference_embeddings`
- **Migration:** `046_create_preference_memory_system.sql`
- Stores user preferences with embeddings for semantic retrieval

### Vector Extension
- **Migration:** `045_enable_pgvector_extension.sql`
- Enables pgvector extension for vector operations

---

## Key Design Decisions

1. **Sequential Function Calls**: The system loops through function calls until LLM returns a final response, enabling complex multi-step workflows.

2. **Semantic + Category Search**: Combines vector embeddings (semantic) with category matching (structured) for better recall.

3. **Intent Expansion**: Uses LLM to expand queries intelligently, handling brand variations and category synonyms.

4. **Multi-Shop Search**: Searches across all shops simultaneously, then groups and ranks results.

5. **Batch Operations**: Supports batch adding items to cart for efficiency.

6. **Context Preservation**: Conversation history is maintained, allowing LLM to reference previous searches and decisions.

---

## File Reference Map

### Core Agent Files
- `src/components/conversational/ConversationalInterface.tsx` - Main UI and orchestration
- `src/context/ConversationContext.tsx` - Conversation state management
- `src/services/ai/conversationManager.ts` - Message history and LLM interaction
- `src/services/ai/functionRouter.ts` - Function execution router
- `src/services/ai/functionSchemas.ts` - Function definitions for LLM

### Search & Intelligence
- `src/services/ai/intelligentSearchService.ts` - Intent understanding and multi-shop search
- `src/services/ai/inventorySearchRAG.ts` - Semantic item search using embeddings
- `src/services/ai/embeddingService.ts` - Embedding generation
- `src/services/ai/openAIService.ts` - OpenAI API client

### Memory & Preferences
- `src/services/ai/memoryRetrievalService.ts` - User preference retrieval

### Cart & Orders
- `src/context/CartContext.tsx` - Cart state management
- `src/services/consumer/orderService.ts` - Order placement
- `src/services/consumer/shopService.ts` - Shop and item fetching
- `src/services/consumer/stockValidationService.ts` - Stock validation

### Database Migrations
- `supabase/migrations/045_enable_pgvector_extension.sql` - Vector support
- `supabase/migrations/046_create_preference_memory_system.sql` - User preferences
- `supabase/migrations/047_create_inventory_embeddings.sql` - Item embeddings
- `supabase/migrations/049_fix_merchant_item_embeddings_index.sql` - Index optimization

---

## Data Flow Diagram

```
User Input
    ↓
ConversationalInterface.handleSendMessage()
    ↓
ConversationContext.sendMessage()
    ↓
ConversationManager.sendMessage() → OpenAI API
    ↓
[Function Call Detected?]
    ↓ YES
FunctionRouter.executeFunctionCall()
    ↓
[Function Type?]
    ├─ intelligentSearch
    │   ↓
    │   IntelligentSearchService.intelligentSearch()
    │   ├─ understandSearchIntent() → LLM
    │   ├─ findShopsByLocation()
    │   ├─ searchItemsAcrossShops() → Vector Search
    │   └─ searchItemsByCategories() → Category Search
    │
    ├─ addItemsToCart
    │   ↓
    │   FunctionRouter.executeAddItemsToCart()
    │   ├─ getItemDetailsFn() → fetchShopItems()
    │   ├─ validateItemStock()
    │   └─ addItemToCartFn() → CartContext
    │
    └─ placeOrder
        ↓
        FunctionRouter.executePlaceOrder()
        └─ orderService.placeOrder()
            └─ Database: Create order
```

---

## Error Handling

- Function execution errors are caught and reported to LLM
- Stock validation failures prevent adding unavailable items
- Search failures fall back to text search
- Embedding generation failures fall back to text search
- Maximum 10 function call iterations to prevent infinite loops

---

## Performance Considerations

- Vector search uses HNSW index for fast approximate nearest neighbor search
- Batch operations reduce API calls
- Message history is managed to prevent context window overflow
- Embeddings are cached when possible
- Shop search is location-based (only searches relevant shops)

