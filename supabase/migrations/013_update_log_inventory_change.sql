-- Adjust audit log trigger to skip logging deletes (prevents FK violations)

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
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
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
    NEW.id,
    jsonb_strip_nulls(jsonb_build_object(
      'id', actor_id,
      'role', actor_role,
      'email', actor_email
    )),
    TG_OP,
    diff,
    source_hint
  );

  IF TG_OP = 'INSERT' OR diff <> '{}'::JSONB THEN
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


