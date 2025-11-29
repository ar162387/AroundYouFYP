-- ============================================================================
-- USER PREFERENCE MEMORY SYSTEM
-- ============================================================================
-- Creates tables for storing user preferences with both structured data
-- and vector embeddings for semantic search and personalization.
-- ============================================================================

-- ============================================================================
-- USER PREFERENCES TABLE (Structured Data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preference_type TEXT NOT NULL CHECK (preference_type IN ('brand', 'item', 'category', 'shop', 'dietary')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('item', 'shop', 'category')),
  entity_id UUID, -- references merchant_items.id, shops.id, merchant_categories.id, etc.
  entity_name TEXT NOT NULL, -- denormalized for easier querying
  preference_value TEXT NOT NULL CHECK (preference_value IN ('prefers', 'avoids', 'allergic_to')),
  confidence_score NUMERIC(3,2) DEFAULT 0.5 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
  source TEXT NOT NULL CHECK (source IN ('explicit', 'inferred_from_order', 'conversation')),
  context JSONB, -- additional context (e.g., {"only_for": "snacks", "when": "evening"})
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(user_id, preference_type, entity_id)
);

-- ============================================================================
-- USER PREFERENCE EMBEDDINGS TABLE (Vector Storage)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_preference_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preference_id UUID NOT NULL REFERENCES public.user_preferences(id) ON DELETE CASCADE,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimensions
  metadata JSONB, -- stores original preference text for context
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Indexes for user_preferences
CREATE INDEX idx_user_preferences_user_id ON public.user_preferences(user_id);
CREATE INDEX idx_user_preferences_preference_type ON public.user_preferences(preference_type);
CREATE INDEX idx_user_preferences_entity_type ON public.user_preferences(entity_type);
CREATE INDEX idx_user_preferences_user_preference_type ON public.user_preferences(user_id, preference_type);
CREATE INDEX idx_user_preferences_confidence ON public.user_preferences(confidence_score DESC);

-- Indexes for user_preference_embeddings
CREATE INDEX idx_user_preference_embeddings_user_id ON public.user_preference_embeddings(user_id);
CREATE INDEX idx_user_preference_embeddings_preference_id ON public.user_preference_embeddings(preference_id);

-- Vector similarity search index (HNSW for fast approximate nearest neighbor search)
CREATE INDEX idx_user_preference_embeddings_vector ON public.user_preference_embeddings 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update user_preferences updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to search preferences by similarity (for RAG)
CREATE OR REPLACE FUNCTION search_user_preferences_by_similarity(
  p_user_id UUID,
  p_query_embedding vector(1536),
  p_limit INTEGER DEFAULT 5,
  p_min_confidence NUMERIC DEFAULT 0.5
)
RETURNS TABLE (
  preference_id UUID,
  user_preference_id UUID,
  preference_type TEXT,
  entity_type TEXT,
  entity_id UUID,
  entity_name TEXT,
  preference_value TEXT,
  confidence_score NUMERIC,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.id as preference_id,
    up.id as user_preference_id,
    up.preference_type,
    up.entity_type,
    up.entity_id,
    up.entity_name,
    up.preference_value,
    up.confidence_score,
    1 - (upe.embedding <=> p_query_embedding) as similarity
  FROM public.user_preference_embeddings upe
  INNER JOIN public.user_preferences up ON up.id = upe.preference_id
  WHERE upe.user_id = p_user_id
    AND up.confidence_score >= p_min_confidence
  ORDER BY upe.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update user_preferences updated_at
CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preference_embeddings ENABLE ROW LEVEL SECURITY;

-- User Preferences Policies
-- Users can view their own preferences
CREATE POLICY "Users can view their own preferences"
  ON public.user_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert their own preferences"
  ON public.user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update their own preferences"
  ON public.user_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own preferences
CREATE POLICY "Users can delete their own preferences"
  ON public.user_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- User Preference Embeddings Policies
-- Users can view their own preference embeddings
CREATE POLICY "Users can view their own preference embeddings"
  ON public.user_preference_embeddings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own preference embeddings
CREATE POLICY "Users can insert their own preference embeddings"
  ON public.user_preference_embeddings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own preference embeddings
CREATE POLICY "Users can update their own preference embeddings"
  ON public.user_preference_embeddings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own preference embeddings
CREATE POLICY "Users can delete their own preference embeddings"
  ON public.user_preference_embeddings
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.user_preferences IS 'Stores structured user preferences for personalization';
COMMENT ON TABLE public.user_preference_embeddings IS 'Stores vector embeddings of user preferences for semantic search';
COMMENT ON COLUMN public.user_preferences.preference_type IS 'Type of preference: brand, item, category, shop, or dietary';
COMMENT ON COLUMN public.user_preferences.entity_type IS 'What the preference refers to: item, shop, or category';
COMMENT ON COLUMN public.user_preferences.entity_id IS 'UUID reference to the entity (merchant_items.id, shops.id, etc.)';
COMMENT ON COLUMN public.user_preferences.entity_name IS 'Denormalized entity name for easier querying';
COMMENT ON COLUMN public.user_preferences.preference_value IS 'Whether user prefers, avoids, or is allergic to this entity';
COMMENT ON COLUMN public.user_preferences.confidence_score IS 'Confidence level 0.0-1.0 based on how certain we are of this preference';
COMMENT ON COLUMN public.user_preferences.source IS 'How this preference was learned: explicit user input, inferred from orders, or conversation';
COMMENT ON COLUMN public.user_preferences.context IS 'Additional context as JSONB (e.g., only applies to snacks, only in evenings)';
COMMENT ON COLUMN public.user_preference_embeddings.embedding IS '1536-dimensional vector embedding for semantic similarity search';
COMMENT ON COLUMN public.user_preference_embeddings.metadata IS 'Original preference text and context stored as JSONB';
COMMENT ON FUNCTION search_user_preferences_by_similarity IS 'Searches user preferences by vector similarity for RAG retrieval';

