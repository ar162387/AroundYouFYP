-- ============================================================================
-- FIX MERCHANT ITEM EMBEDDINGS INDEX
-- ============================================================================
-- Drops and recreates all merchant_item_embeddings related objects:
-- - Table, indexes, functions, triggers, and RLS policies
-- - Ensures OpenAI-compatible embeddings (1536 dimensions) are properly configured
-- ============================================================================

-- ============================================================================
-- DROP EXISTING OBJECTS
-- ============================================================================

-- Drop triggers first (they depend on functions)
DROP TRIGGER IF EXISTS merchant_item_embeddings_updated_at ON public.merchant_item_embeddings;

-- Drop functions
DROP FUNCTION IF EXISTS public.search_items_across_shops_by_similarity(UUID[], vector(1536), INTEGER, FLOAT);
DROP FUNCTION IF EXISTS public.search_items_by_similarity(UUID, vector(1536), INTEGER, FLOAT);
DROP FUNCTION IF EXISTS public.update_merchant_item_embeddings_updated_at();

-- Drop RLS policies
DROP POLICY IF EXISTS "Merchants can delete embeddings for their items" ON public.merchant_item_embeddings;
DROP POLICY IF EXISTS "Merchants can update embeddings for their items" ON public.merchant_item_embeddings;
DROP POLICY IF EXISTS "Merchants can insert embeddings for their items" ON public.merchant_item_embeddings;
DROP POLICY IF EXISTS "Anyone can view item embeddings" ON public.merchant_item_embeddings;

-- Drop indexes
DROP INDEX IF EXISTS public.idx_merchant_item_embeddings_vector;
DROP INDEX IF EXISTS public.idx_merchant_item_embeddings_merchant_item_id;
DROP INDEX IF EXISTS public.idx_merchant_item_embeddings_shop_id;
DROP INDEX IF EXISTS public.idx_merchant_item_embeddings_shop_vector;

-- Drop table (this will cascade to any remaining dependencies)
DROP TABLE IF EXISTS public.merchant_item_embeddings CASCADE;

-- ============================================================================
-- RECREATE MERCHANT ITEM EMBEDDINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.merchant_item_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_item_id UUID NOT NULL REFERENCES public.merchant_items(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimensions
  search_text TEXT NOT NULL, -- name + description + categories concatenated for embedding
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(merchant_item_id)
);

-- ============================================================================
-- RECREATE INDEXES
-- ============================================================================

-- Index for shop lookups
CREATE INDEX idx_merchant_item_embeddings_shop_id ON public.merchant_item_embeddings(shop_id);
CREATE INDEX idx_merchant_item_embeddings_merchant_item_id ON public.merchant_item_embeddings(merchant_item_id);

-- Vector similarity search index (HNSW for fast approximate nearest neighbor search)
CREATE INDEX idx_merchant_item_embeddings_vector ON public.merchant_item_embeddings 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Note: We don't create a composite index with embedding included because
-- vectors are too large for btree indexes. The HNSW index handles vector searches,
-- and we can filter by shop_id in the query after vector similarity search.

-- ============================================================================
-- RECREATE FUNCTIONS
-- ============================================================================

-- Function to update merchant_item_embeddings updated_at timestamp
CREATE OR REPLACE FUNCTION update_merchant_item_embeddings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to search items by similarity within a shop
CREATE OR REPLACE FUNCTION search_items_by_similarity(
  p_shop_id UUID,
  p_query_embedding vector(1536),
  p_limit INTEGER DEFAULT 10,
  p_min_similarity FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  merchant_item_id UUID,
  item_name TEXT,
  item_description TEXT,
  item_image_url TEXT,
  price_cents INTEGER,
  is_active BOOLEAN,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mi.id as merchant_item_id,
    mi.name as item_name,
    mi.description as item_description,
    mi.image_url as item_image_url,
    mi.price_cents,
    mi.is_active,
    1 - (mie.embedding <=> p_query_embedding) as similarity
  FROM public.merchant_item_embeddings mie
  INNER JOIN public.merchant_items mi ON mi.id = mie.merchant_item_id
  WHERE mie.shop_id = p_shop_id
    AND mi.is_active = true
    AND (1 - (mie.embedding <=> p_query_embedding)) >= p_min_similarity
  ORDER BY mie.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search items across multiple shops by similarity
CREATE OR REPLACE FUNCTION search_items_across_shops_by_similarity(
  p_shop_ids UUID[],
  p_query_embedding vector(1536),
  p_limit INTEGER DEFAULT 10,
  p_min_similarity FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  merchant_item_id UUID,
  shop_id UUID,
  shop_name TEXT,
  item_name TEXT,
  item_description TEXT,
  item_image_url TEXT,
  price_cents INTEGER,
  is_active BOOLEAN,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mi.id as merchant_item_id,
    s.id as shop_id,
    s.name as shop_name,
    mi.name as item_name,
    mi.description as item_description,
    mi.image_url as item_image_url,
    mi.price_cents,
    mi.is_active,
    1 - (mie.embedding <=> p_query_embedding) as similarity
  FROM public.merchant_item_embeddings mie
  INNER JOIN public.merchant_items mi ON mi.id = mie.merchant_item_id
  INNER JOIN public.shops s ON s.id = mie.shop_id
  WHERE mie.shop_id = ANY(p_shop_ids)
    AND mi.is_active = true
    AND s.is_open = true
    AND (1 - (mie.embedding <=> p_query_embedding)) >= p_min_similarity
  ORDER BY mie.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RECREATE TRIGGERS
-- ============================================================================

-- Trigger to update merchant_item_embeddings updated_at
CREATE TRIGGER merchant_item_embeddings_updated_at
  BEFORE UPDATE ON public.merchant_item_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_merchant_item_embeddings_updated_at();

-- ============================================================================
-- RECREATE ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.merchant_item_embeddings ENABLE ROW LEVEL SECURITY;

-- Public read access for embeddings (consumers need to search)
CREATE POLICY "Anyone can view item embeddings"
  ON public.merchant_item_embeddings
  FOR SELECT
  USING (true);

-- Merchants can insert embeddings for their items
CREATE POLICY "Merchants can insert embeddings for their items"
  ON public.merchant_item_embeddings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops s
      JOIN public.merchant_accounts ma ON ma.id = s.merchant_id
      WHERE s.id = shop_id AND ma.user_id = auth.uid()
    )
  );

-- Merchants can update embeddings for their items
CREATE POLICY "Merchants can update embeddings for their items"
  ON public.merchant_item_embeddings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      JOIN public.merchant_accounts ma ON ma.id = s.merchant_id
      WHERE s.id = shop_id AND ma.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops s
      JOIN public.merchant_accounts ma ON ma.id = s.merchant_id
      WHERE s.id = shop_id AND ma.user_id = auth.uid()
    )
  );

-- Merchants can delete embeddings for their items
CREATE POLICY "Merchants can delete embeddings for their items"
  ON public.merchant_item_embeddings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      JOIN public.merchant_accounts ma ON ma.id = s.merchant_id
      WHERE s.id = shop_id AND ma.user_id = auth.uid()
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.merchant_item_embeddings IS 'Stores vector embeddings of merchant items for semantic search';
COMMENT ON COLUMN public.merchant_item_embeddings.embedding IS '1536-dimensional vector embedding for semantic similarity search';
COMMENT ON COLUMN public.merchant_item_embeddings.search_text IS 'Concatenated text (name + description + categories) used to generate the embedding';
COMMENT ON FUNCTION search_items_by_similarity IS 'Searches items within a single shop by vector similarity';
COMMENT ON FUNCTION search_items_across_shops_by_similarity IS 'Searches items across multiple shops by vector similarity, useful for comparing shops';

