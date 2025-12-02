-- ============================================================================
-- REMOVE is_open FILTER FROM VECTOR SEARCH FUNCTIONS
-- ============================================================================
-- The app computes opening status dynamically from opening_hours, holidays,
-- and open_status_mode. The static is_open field should not filter vector
-- search results, as shops may be open according to their hours even if
-- is_open is false.
-- ============================================================================

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
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
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
    AND mie.embedding IS NOT NULL
    AND (1 - (mie.embedding <=> p_query_embedding)) >= p_min_similarity
  ORDER BY mie.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;

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
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validate input parameters
  IF p_shop_ids IS NULL OR array_length(p_shop_ids, 1) = 0 THEN
    RETURN;
  END IF;
  
  IF p_query_embedding IS NULL THEN
    RETURN;
  END IF;
  
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
    AND mie.embedding IS NOT NULL
    AND (1 - (mie.embedding <=> p_query_embedding)) >= p_min_similarity
  ORDER BY mie.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION search_items_by_similarity IS 'Searches items within a single shop by vector similarity. Removed is_open filter to allow dynamic opening status computation.';
COMMENT ON FUNCTION search_items_across_shops_by_similarity IS 'Searches items across multiple shops by vector similarity. Removed is_open filter to allow dynamic opening status computation.';

