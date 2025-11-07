-- Inventory system schema for merchant catalog management

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Template catalog tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.category_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now())
);

CREATE TABLE IF NOT EXISTS public.item_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  barcode TEXT,
  description TEXT,
  image_url TEXT,
  default_unit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now())
);

-- ============================================================================
-- Merchant scoped inventory tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.merchant_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.category_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now())
);

CREATE UNIQUE INDEX merchant_categories_unique_name
  ON public.merchant_categories (shop_id, lower(name));

CREATE TABLE IF NOT EXISTS public.merchant_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.item_templates(id) ON DELETE SET NULL,
  name TEXT,
  description TEXT,
  barcode TEXT,
  image_url TEXT,
  sku TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'PKR',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_custom BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now()),
  created_by UUID DEFAULT auth.uid(),
  last_updated_by JSONB DEFAULT NULL,
  CONSTRAINT chk_active_requires_sku CHECK (
    NOT is_active OR (sku IS NOT NULL AND btrim(sku) <> '')
  )
);

CREATE UNIQUE INDEX merchant_items_unique_sku
  ON public.merchant_items (shop_id, lower(sku))
  WHERE sku IS NOT NULL AND btrim(sku) <> '';

CREATE TABLE IF NOT EXISTS public.merchant_item_categories (
  merchant_item_id UUID NOT NULL REFERENCES public.merchant_items(id) ON DELETE CASCADE,
  merchant_category_id UUID NOT NULL REFERENCES public.merchant_categories(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (merchant_item_id, merchant_category_id)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  merchant_item_id UUID NOT NULL REFERENCES public.merchant_items(id) ON DELETE CASCADE,
  actor JSONB NOT NULL,
  action_type TEXT NOT NULL,
  changed_fields JSONB NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::TEXT, now())
);

CREATE INDEX audit_logs_shop_created_at_idx ON public.audit_logs (shop_id, created_at DESC);

-- ============================================================================
-- Utility functions and triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::TEXT, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.set_inventory_last_updated_actor()
RETURNS TRIGGER AS $$
DECLARE
  actor_id UUID;
  actor_role TEXT;
  actor_email TEXT;
BEGIN
  actor_id := auth.uid();
  actor_role := current_setting('request.jwt.claim.role', true);
  actor_email := current_setting('request.jwt.claim.email', true);

  IF actor_id IS NOT NULL THEN
    NEW.last_updated_by := jsonb_build_object(
      'id', actor_id,
      'role', actor_role,
      'email', actor_email
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.log_inventory_change()
RETURNS TRIGGER AS $$
DECLARE
  diff JSONB := '{}'::JSONB;
  actor_id UUID := auth.uid();
  actor_role TEXT := current_setting('request.jwt.claim.role', true);
  actor_email TEXT := current_setting('request.jwt.claim.email', true);
  source_hint TEXT := COALESCE((current_setting('request.headers', true)::JSON ->> 'x-change-source'), 'manual');
  target_shop UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    diff := jsonb_strip_nulls(jsonb_build_object(
      'sku', jsonb_build_object('from', NULL, 'to', NEW.sku),
      'price_cents', jsonb_build_object('from', NULL, 'to', NEW.price_cents),
      'is_active', jsonb_build_object('from', NULL, 'to', NEW.is_active)
    ));
    target_shop := NEW.shop_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.sku IS DISTINCT FROM OLD.sku THEN
      diff := diff || jsonb_build_object('sku', jsonb_build_object('from', OLD.sku, 'to', NEW.sku));
    END IF;
    IF NEW.price_cents IS DISTINCT FROM OLD.price_cents THEN
      diff := diff || jsonb_build_object('price_cents', jsonb_build_object('from', OLD.price_cents, 'to', NEW.price_cents));
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      diff := diff || jsonb_build_object('is_active', jsonb_build_object('from', OLD.is_active, 'to', NEW.is_active));
    END IF;
    IF NEW.description IS DISTINCT FROM OLD.description THEN
      diff := diff || jsonb_build_object('description', jsonb_build_object('from', OLD.description, 'to', NEW.description));
    END IF;
    IF NEW.template_id IS DISTINCT FROM OLD.template_id THEN
      diff := diff || jsonb_build_object('template_id', jsonb_build_object('from', OLD.template_id, 'to', NEW.template_id));
    END IF;
    target_shop := NEW.shop_id;
  ELSIF TG_OP = 'DELETE' THEN
    diff := jsonb_build_object('deleted', jsonb_build_object('from', OLD.is_active, 'to', NULL));
    target_shop := OLD.shop_id;
  END IF;

  INSERT INTO public.audit_logs (
    shop_id,
    merchant_item_id,
    actor,
    action_type,
    changed_fields,
    source
  ) VALUES (
    target_shop,
    COALESCE(NEW.id, OLD.id),
    jsonb_strip_nulls(jsonb_build_object(
      'id', actor_id,
      'role', actor_role,
      'email', actor_email
    )),
    TG_OP,
    COALESCE(NULLIF(diff, '{}'::JSONB), jsonb_build_object('noop', jsonb_build_object('from', NULL, 'to', NULL))),
    source_hint
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER merchant_categories_touch
  BEFORE UPDATE ON public.merchant_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER merchant_items_touch
  BEFORE UPDATE ON public.merchant_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER merchant_items_actor
  BEFORE UPDATE ON public.merchant_items
  FOR EACH ROW EXECUTE FUNCTION public.set_inventory_last_updated_actor();

CREATE TRIGGER merchant_items_log_insert
  AFTER INSERT ON public.merchant_items
  FOR EACH ROW EXECUTE FUNCTION public.log_inventory_change();

CREATE TRIGGER merchant_items_log_update
  AFTER UPDATE ON public.merchant_items
  FOR EACH ROW EXECUTE FUNCTION public.log_inventory_change();

CREATE TRIGGER merchant_items_log_delete
  AFTER DELETE ON public.merchant_items
  FOR EACH ROW EXECUTE FUNCTION public.log_inventory_change();

-- ============================================================================
-- Views
-- ============================================================================

CREATE OR REPLACE VIEW public.merchant_item_view AS
SELECT
  mi.id,
  mi.shop_id,
  mi.template_id,
  mi.sku,
  mi.price_cents,
  mi.currency,
  mi.is_active,
  mi.is_custom,
  mi.created_at,
  mi.updated_at,
  COALESCE(mi.name, it.name) AS name,
  COALESCE(mi.description, it.description) AS description,
  COALESCE(mi.barcode, it.barcode) AS barcode,
  COALESCE(mi.image_url, it.image_url) AS image_url,
  COALESCE(mi.last_updated_by, jsonb_build_object()) AS last_updated_by,
  COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
    'id', mc.id,
    'name', mc.name,
    'description', mc.description,
    'isActive', mc.is_active
  )) FILTER (WHERE mc.id IS NOT NULL), '[]'::JSONB) AS categories,
  COALESCE(array_agg(DISTINCT mc.id) FILTER (WHERE mc.id IS NOT NULL), ARRAY[]::UUID[]) AS category_ids,
  (
    setweight(to_tsvector('simple', COALESCE(mi.name, it.name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(mi.sku, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(mi.barcode, '')), 'B')
  ) AS search_vector
FROM public.merchant_items mi
LEFT JOIN public.item_templates it ON it.id = mi.template_id
LEFT JOIN public.merchant_item_categories mic ON mic.merchant_item_id = mi.id
LEFT JOIN public.merchant_categories mc ON mc.id = mic.merchant_category_id
GROUP BY mi.id, mi.shop_id, mi.template_id, mi.sku, mi.price_cents, mi.currency, mi.is_active, mi.is_custom, mi.created_at, mi.updated_at, mi.name, mi.description, mi.barcode, mi.image_url, mi.last_updated_by, it.name, it.description, it.barcode, it.image_url;

-- ============================================================================
-- Bulk adoption RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.bulk_adopt_templates(
  p_shop_id UUID,
  p_template_ids UUID[],
  p_default_category_id UUID DEFAULT NULL
)
RETURNS TABLE (job_id UUID)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  template_record public.item_templates%ROWTYPE;
  adopted_item_id UUID;
  new_job_id UUID := uuid_generate_v4();
BEGIN
  IF p_template_ids IS NULL OR array_length(p_template_ids, 1) = 0 THEN
    RETURN QUERY SELECT new_job_id;
    RETURN;
  END IF;

  FOR template_record IN
    SELECT * FROM public.item_templates WHERE id = ANY (p_template_ids)
  LOOP
    INSERT INTO public.merchant_items (
      shop_id,
      template_id,
      name,
      description,
      barcode,
      image_url,
      sku,
      price_cents,
      currency,
      is_active,
      is_custom
    ) VALUES (
      p_shop_id,
      template_record.id,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      0,
      'PKR',
      TRUE,
      FALSE
    ) RETURNING id INTO adopted_item_id;

    IF p_default_category_id IS NOT NULL THEN
      INSERT INTO public.merchant_item_categories (merchant_item_id, merchant_category_id)
      VALUES (adopted_item_id, p_default_category_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN QUERY SELECT new_job_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_adopt_templates(UUID, UUID[], UUID) TO authenticated;

-- ============================================================================
-- Row level security policies
-- ============================================================================

ALTER TABLE public.category_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY category_templates_read ON public.category_templates
  FOR SELECT USING (true);

CREATE POLICY item_templates_read ON public.item_templates
  FOR SELECT USING (true);

CREATE POLICY merchant_categories_select ON public.merchant_categories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      JOIN public.merchant_accounts ma ON ma.id = s.merchant_id
      WHERE s.id = merchant_categories.shop_id
        AND ma.user_id = auth.uid()
    )
  );

CREATE POLICY merchant_categories_modify ON public.merchant_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      JOIN public.merchant_accounts ma ON ma.id = s.merchant_id
      WHERE s.id = merchant_categories.shop_id
        AND ma.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops s
      JOIN public.merchant_accounts ma ON ma.id = s.merchant_id
      WHERE s.id = merchant_categories.shop_id
        AND ma.user_id = auth.uid()
    )
  );

CREATE POLICY merchant_items_select ON public.merchant_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      JOIN public.merchant_accounts ma ON ma.id = s.merchant_id
      WHERE s.id = merchant_items.shop_id
        AND ma.user_id = auth.uid()
    )
  );

CREATE POLICY merchant_items_modify ON public.merchant_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      JOIN public.merchant_accounts ma ON ma.id = s.merchant_id
      WHERE s.id = merchant_items.shop_id
        AND ma.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops s
      JOIN public.merchant_accounts ma ON ma.id = s.merchant_id
      WHERE s.id = merchant_items.shop_id
        AND ma.user_id = auth.uid()
    )
  );

CREATE POLICY merchant_item_categories_select ON public.merchant_item_categories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.merchant_items mi
      JOIN public.shops s ON s.id = mi.shop_id
      JOIN public.merchant_accounts ma ON ma.id = s.merchant_id
      WHERE mi.id = merchant_item_categories.merchant_item_id
        AND ma.user_id = auth.uid()
    )
  );

CREATE POLICY merchant_item_categories_modify ON public.merchant_item_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.merchant_items mi
      JOIN public.shops s ON s.id = mi.shop_id
      JOIN public.merchant_accounts ma ON ma.id = s.merchant_id
      WHERE mi.id = merchant_item_categories.merchant_item_id
        AND ma.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.merchant_items mi
      JOIN public.shops s ON s.id = mi.shop_id
      JOIN public.merchant_accounts ma ON ma.id = s.merchant_id
      WHERE mi.id = merchant_item_categories.merchant_item_id
        AND ma.user_id = auth.uid()
    )
  );

CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      JOIN public.merchant_accounts ma ON ma.id = s.merchant_id
      WHERE s.id = audit_logs.shop_id
        AND ma.user_id = auth.uid()
    )
  );

CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops s
      JOIN public.merchant_accounts ma ON ma.id = s.merchant_id
      WHERE s.id = audit_logs.shop_id
        AND ma.user_id = auth.uid()
    )
  );

COMMENT ON FUNCTION public.bulk_adopt_templates IS 'Adopt multiple item templates into a merchant shop inventory';
COMMENT ON VIEW public.merchant_item_view IS 'Computed view merging merchant overrides with global item templates';



