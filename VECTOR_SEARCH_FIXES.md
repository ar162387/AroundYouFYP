# Vector Search Fixes - December 2, 2025

## Issues Identified

### 1. **MessageBubble Caching Stale Reasoning** ✅ FIXED
**Problem:** The MessageBubble component was caching old reasoning/thinking data from previous queries, causing confusion when users made new searches.

**Root Cause:** The `persistedProgress` state was holding onto old search progress data and displaying it even for new queries.

**Fix:** 
- Added logic to clear `persistedProgress` when message content or function call/result changes
- Added conditional logic to only show steps when there's an active progress or a function result for the current message
- This ensures the UI always shows fresh, synchronized data for the current query

**Files Changed:**
- `src/components/conversational/MessageBubble.tsx`

---

### 2. **Vector Search Returning 0 Results** ✅ FIXED
**Problem:** Vector search was returning 0 results for queries like "Oreo mini", "Capstan", and "Dunhill" even though:
- Embeddings existed in the database (88 total embeddings)
- The items existed with active embeddings
- The vector search function was working correctly

**Root Cause:** **Similarity threshold was too high (0.5-0.7)**. 

When testing with real embeddings:
- "Oreo mini" query achieved only ~44% similarity with "Oreo Mini Original Munch Pack 1 Piece"
- Short queries and item name variations result in lower similarity scores
- The threshold of 0.5 was filtering out valid matches

**Why Low Similarity?**
- Query: "Oreo mini" (2 words)
- Item: "Oreo Mini Original Munch Pack 1 Piece" (7 words)
- The additional descriptive text in the item name dilutes the similarity score
- Semantic embeddings consider the entire context, so longer descriptions reduce similarity for short queries

**Fix:**
Lowered similarity thresholds across the board:
- `intelligentSearchService.ts`: 0.5 → 0.35
- `inventorySearchRAG.ts` (searchItemsAcrossShops): 0.7 → 0.35
- `inventorySearchRAG.ts` (searchItemsInShop): 0.6 → 0.35
- Database RPC calls: 0.5 → 0.3 (initial filter, refined with minSimilarity later)

**Validation:**
With threshold 0.3:
- ✅ "Capstan" found with 57% similarity
- ✅ "Dunhill" found with 66.7% similarity
- ✅ "Oreo mini" returns results (though matches are ~44% - still useful as fallback before category search)

**Files Changed:**
- `src/services/ai/intelligentSearchService.ts`
- `src/services/ai/inventorySearchRAG.ts`

---

### 3. **Improved Error Logging** ✅ ADDED
**Enhancement:** Added comprehensive debug logging to diagnose vector search issues.

**What Was Added:**
- Detailed parameter logging before RPC calls
- Embedding dimension and sample values logging
- Clear warnings when searches return 0 results with possible reasons
- Sample result logging when results are found
- Enhanced error messages with hints and details

**Files Changed:**
- `src/services/ai/inventorySearchRAG.ts`

---

## Diagnostic Scripts Created

### 1. **check-embeddings.ts**
Comprehensive diagnostic script that:
- ✅ Checks total embeddings count
- ✅ Verifies embeddings with non-null vectors
- ✅ Searches for specific test items (Oreo, Capstan, Dunhill)
- ✅ Checks if vector search functions exist
- ✅ Tests sample vector search with dummy embedding

**Usage:** `npx ts-node scripts/check-embeddings.ts`

### 2. **test-vector-search.ts**
Real-world test script that:
- ✅ Generates actual query embeddings using OpenAI
- ✅ Calls vector search functions with real queries
- ✅ Tests multiple similarity thresholds
- ✅ Checks if matching items exist in searched shops
- ✅ Provides detailed output for debugging

**Usage:** `npx ts-node scripts/test-vector-search.ts`

---

## Test Results

### Before Fixes:
- ❌ "Oreo mini" → 0 results (threshold 0.5)
- ❌ "Capstan" → 0 results in some shops
- ❌ "Dunhill" → 0 results in some shops
- ❌ UI showed stale reasoning from previous queries

### After Fixes:
- ✅ "Oreo mini" → Results found (via category fallback + improved vector search)
- ✅ "Capstan" → 57% similarity match found
- ✅ "Dunhill" → 66.7% similarity match found
- ✅ UI shows fresh, synchronized reasoning for each query
- ✅ Category search provides strong fallback when vector search yields low-confidence results

---

## Key Learnings

1. **Semantic Search Sensitivity:** Short queries with long, descriptive item names produce lower similarity scores. The threshold must account for this.

2. **Embedding Dimension:** Both stored and query embeddings use `text-embedding-3-small` with dimension 1536 - consistency is critical.

3. **Multi-Layer Search Strategy:** The intelligent search uses:
   - **Layer 1:** Vector search (now with 0.35 threshold)
   - **Layer 2:** Category-based search (fallback)
   - **Layer 3:** Relevance scoring and ranking

4. **UI State Management:** React state persistence can cause stale data issues. Clear side effects are needed when message context changes.

---

## Migration Note

The migration `054_fix_vector_search_functions.sql` already exists and defines the vector search functions with proper `SET search_path = public`. The functions are working correctly as validated by the diagnostic scripts. No additional migration is needed.

---

## Future Improvements

1. **Dynamic Threshold Adjustment:** Consider adjusting similarity threshold based on query length
2. **Query Expansion:** The LLM already expands queries - ensure expanded queries are also being searched
3. **Embedding Model Updates:** Monitor OpenAI's embedding models for improvements
4. **A/B Testing:** Test different thresholds with real users to find optimal balance
5. **Caching:** Consider caching query embeddings for frequently searched terms

---

## Files Modified

1. `src/components/conversational/MessageBubble.tsx` - Fixed stale reasoning caching
2. `src/services/ai/intelligentSearchService.ts` - Lowered similarity threshold
3. `src/services/ai/inventorySearchRAG.ts` - Lowered thresholds + added detailed logging
4. `scripts/check-embeddings.ts` - NEW diagnostic script
5. `scripts/test-vector-search.ts` - NEW test script

---

## Testing Recommendations

1. **Smoke Test:** Search for "Oreo mini", "Capstan", "Dunhill" in the app
2. **Edge Cases:** Test very short queries (1 word) and very long queries (5+ words)
3. **Category Fallback:** Verify items are found via category search when vector search confidence is low
4. **UI Sync:** Verify reasoning bubble shows fresh data for each new query
5. **Debug Logs:** Check metro/react-native logs for detailed search debug info

---

## Deployment Checklist

- [x] Lower similarity thresholds
- [x] Add comprehensive logging
- [x] Fix MessageBubble stale state
- [x] Create diagnostic scripts
- [x] Test with real data
- [ ] Monitor search quality in production
- [ ] Gather user feedback on search relevance
- [ ] Adjust thresholds if needed based on analytics


