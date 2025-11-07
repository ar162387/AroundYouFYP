-- Ensure case-insensitive uniqueness for item_templates.name

ALTER TABLE public.item_templates
  ADD COLUMN IF NOT EXISTS name_normalized TEXT GENERATED ALWAYS AS (lower(trim(name))) STORED;

ALTER TABLE public.item_templates
  ADD CONSTRAINT item_templates_name_normalized_key UNIQUE (name_normalized);


