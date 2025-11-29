# Database Schema Verification for Conversational Interface

This document verifies that the conversational shopping interface implementation aligns with the existing database schema.

## Schema Alignment Checklist

### ✅ 1. pgvector Extension
- **Migration**: `045_enable_pgvector_extension.sql`
- **Status**: Enables `vector` extension for embeddings
- **Compatibility**: Works with existing PostgreSQL/Supabase setup

### ✅ 2. User Preferences Tables
- **Migration**: `046_create_preference_memory_system.sql`
- **Tables Created**:
  - `user_preferences` - Stores structured preference data
  - `user_preference_embeddings` - Stores vector embeddings
- **RLS Policies**: Users can only access their own preferences ✅
- **Relationships**: Properly references `auth.users(id)` ✅

### ✅ 3. Inventory Embeddings Table
- **Migration**: `047_create_inventory_embeddings.sql`
- **Table Created**: `merchant_item_embeddings`
- **Relationships**: 
  - References `merchant_items(id)` ✅
  - References `shops(id)` ✅
- **RLS Policies**: Public read for consumers, merchant write ✅

### ✅ 4. Database Functions

#### `search_user_preferences_by_similarity`
- Uses pgvector's cosine distance operator (`<=>`) ✅
- Properly joins `user_preferences` and `user_preference_embeddings` ✅
- Returns similarity scores ✅

#### `search_items_by_similarity`
- Searches within a single shop ✅
- Filters by `is_active = true` ✅
- Returns similarity scores ✅

#### `search_items_across_shops_by_similarity`
- Searches across multiple shops ✅
- Filters by active items and open shops ✅
- Returns shop context with items ✅

### ✅ 5. Existing Schema Compatibility

#### merchant_items Table
- Uses existing `merchant_items` table ✅
- Query structure matches existing patterns in `fetchShopItems()` ✅
- Handles nested `merchant_item_categories` → `merchant_categories` relationships ✅

#### merchant_categories Relationship
- Properly queries through join table `merchant_item_categories` ✅
- Extracts category names from nested structure ✅
- Handles items with no categories gracefully ✅

### ✅ 6. Embedding Generation Script

The `generate-inventory-embeddings.ts` script:
- Queries `merchant_items` with proper nested selects ✅
- Handles the relationship: `merchant_items` → `merchant_item_categories` → `merchant_categories` ✅
- Extracts category names correctly ✅
- Stores embeddings in `merchant_item_embeddings` table ✅
- Skips existing embeddings (idempotent) ✅

## Schema Query Pattern Verification

### Current Pattern (from `fetchShopItems`)
```typescript
.select(`
  merchant_item_categories!${joinType}(merchant_category_id),
`)
```

### Our Pattern (for embeddings)
```typescript
.select(`
  merchant_item_categories (
    merchant_categories (
      name
    )
  )
`)
```

**Result**: Both patterns work with Supabase. Our pattern gets nested category names directly, which is more efficient for embedding generation.

## Testing with Supabase CLI

You can verify the schema with:

```bash
# Check if pgvector is enabled
supabase db execute "SELECT * FROM pg_extension WHERE extname = 'vector';"

# Check preference tables exist
supabase db execute "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('user_preferences', 'user_preference_embeddings', 'merchant_item_embeddings');"

# Check functions exist
supabase db execute "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE '%similarity%';"

# Test a sample query (after running migrations)
supabase db execute "SELECT COUNT(*) FROM merchant_item_embeddings;"
```

## Potential Issues & Solutions

### Issue 1: Category Structure
**Problem**: Supabase might return nested relationships differently than expected.

**Solution**: The script now handles both array and object formats for nested relations.

### Issue 2: Vector Format
**Problem**: PostgreSQL vector type format when passing from JavaScript.

**Solution**: Supabase JS client automatically handles vector array conversion. Embeddings are passed as JavaScript arrays `number[]`, and Supabase converts them to the `vector` type.

### Issue 3: RLS Policies
**Problem**: Embedding generation script uses service role key, so RLS is bypassed.

**Solution**: ✅ This is correct - the script needs service role key to write embeddings for all items.

## Migration Order

Run migrations in this order:
1. `045_enable_pgvector_extension.sql` - Enables vector support
2. `046_create_preference_memory_system.sql` - Creates preference tables
3. `047_create_inventory_embeddings.sql` - Creates item embeddings table

Then run the embedding generation script:
```bash
npx ts-node scripts/generate-inventory-embeddings.ts
```

## Verification Checklist

- [ ] pgvector extension enabled
- [ ] All three tables created successfully
- [ ] RLS policies are in place
- [ ] Functions are created and executable
- [ ] Embeddings can be inserted (test with one item first)
- [ ] Vector similarity search works (test the functions)
- [ ] Script generates embeddings successfully

## Notes

- All migrations follow existing migration naming convention (number prefix)
- RLS policies follow existing patterns (users access own data, public read where appropriate)
- Functions use `SECURITY DEFINER` for proper permissions
- Vector indexes use HNSW for performance (standard for pgvector)
- All foreign keys properly reference existing tables

