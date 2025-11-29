-- ============================================================================
-- ENABLE PGVECTOR EXTENSION
-- ============================================================================
-- Enables the pgvector extension for vector similarity search capabilities.
-- This is required for storing and querying embeddings for user preferences
-- and inventory items.
-- ============================================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON EXTENSION vector IS 'Enables vector data type and similarity search for AI embeddings';

