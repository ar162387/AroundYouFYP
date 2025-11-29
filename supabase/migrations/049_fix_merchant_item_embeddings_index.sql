-- ============================================================================
-- FIX MERCHANT ITEM EMBEDDINGS INDEX
-- ============================================================================
-- Removes the problematic composite index that includes the embedding vector.
-- Embedding vectors (1536 dimensions) are too large for btree indexes.
-- The HNSW vector index is sufficient for similarity searches.
-- ============================================================================

-- Drop the problematic composite index if it exists
DROP INDEX IF EXISTS public.idx_merchant_item_embeddings_shop_vector;

-- Note: The HNSW index on embedding (idx_merchant_item_embeddings_vector) is sufficient.
-- We can filter by shop_id in queries without needing it in a composite index.
-- The existing indexes are:
-- - idx_merchant_item_embeddings_shop_id (btree on shop_id) - for filtering
-- - idx_merchant_item_embeddings_merchant_item_id (btree on merchant_item_id) - for lookups
-- - idx_merchant_item_embeddings_vector (HNSW on embedding) - for similarity search

