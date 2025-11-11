Tables (public)
Each table lists columns (name — type — nullable/default/comment), primary key(s), and foreign key references.

user_profiles (rls: enabled)

id — uuid — not null — (PK) — references auth.users(id)
email — text — nullable
name — text — nullable
role — text — not null — default: 'consumer' — check: role ∈ {consumer, merchant, admin}
created_at — timestamptz — nullable — default: now()
updated_at — timestamptz — nullable — default: now()
Primary key: id
Foreign keys: user_profiles.id → auth.users.id
consumer_addresses (rls: enabled) — comment: Stores delivery addresses for consumers

id — uuid — not null — default: extensions.uuid_generate_v4()
user_id — uuid — not null — references auth.users(id)
title — text — nullable — check: title ∈ {home, office} — comment: Optional address title: home or office (unique per user)
street_address — text — not null — comment: Street address without city/region
city — text — not null
region — text — nullable
latitude — numeric — not null
longitude — numeric — not null
landmark — text — nullable — comment: Optional landmark or flat/house number for clarification
formatted_address — text — nullable
created_at — timestamptz — not null — default: timezone('utc', now())
updated_at — timestamptz — not null — default: timezone('utc', now())
Primary key: id
Foreign keys: consumer_addresses.user_id → auth.users.id
merchant_accounts (rls: enabled) — comment: Stores merchant account information including shop type and verification status

id — uuid — not null — default: extensions.uuid_generate_v4()
user_id — uuid — not null — unique — references auth.users(id)
shop_type — text — not null — check: shop_type ∈ {grocery, meat, vegetable, mart, other}
number_of_shops — text — not null — check: number_of_shops ∈ {1,2,3+}
status — text — not null — default: 'none' — check: status ∈ {none,pending,verified}
created_at — timestamptz — not null — default: timezone('utc', now())
updated_at — timestamptz — not null — default: timezone('utc', now())
Primary key: id
Foreign keys: merchant_accounts.user_id → auth.users.id
Note: shops.merchant_id → public.merchant_accounts.id
shops (rls: enabled) — comment: Stores shop information for merchants

id — uuid — not null — default: extensions.uuid_generate_v4()
merchant_id — uuid — not null — references public.merchant_accounts(id) — comment: Reference to the merchant account that owns this shop
name — text — not null
description — text — not null
shop_type — text — not null — check: shop_type ∈ {Grocery, Meat, Vegetable, Stationery, Dairy}
address — text — not null
latitude — double precision — not null — comment: Latitude coordinate for shop location
longitude — double precision — not null — comment: Longitude coordinate for shop location
image_url — text — nullable
tags — text[] — nullable — default: '{}'
is_open — boolean — nullable — default: true
created_at — timestamptz — not null — default: timezone('utc', now())
updated_at — timestamptz — not null — default: timezone('utc', now())
Primary key: id
Foreign keys:
shops.merchant_id → public.merchant_accounts.id
referenced by many tables: shop_delivery_areas.shop_id, delivery_runners.shop_id, shop_delivery_logic.shop_id, merchant_categories.shop_id, merchant_items.shop_id, audit_logs.shop_id
category_templates (rls: enabled)

id — uuid — not null — default: extensions.uuid_generate_v4()
name — text — not null
description — text — nullable
created_at — timestamptz — not null — default: timezone('utc', now())
updated_at — timestamptz — not null — default: timezone('utc', now())
Primary key: id
Foreign keys: merchant_categories.template_id → public.category_templates.id
item_templates (rls: enabled)

id — uuid — not null — default: extensions.uuid_generate_v4()
name — text — not null
barcode — text — nullable
description — text — nullable
image_url — text — nullable
default_unit — text — nullable
created_at — timestamptz — not null — default: timezone('utc', now())
updated_at — timestamptz — not null — default: timezone('utc', now())
name_normalized — text — generated — nullable — unique — default: lower(TRIM(BOTH FROM name))
Primary key: id
Foreign keys: merchant_items.template_id → public.item_templates.id
merchant_categories (rls: enabled)

id — uuid — not null — default: extensions.uuid_generate_v4()
shop_id — uuid — not null — references public.shops.id
template_id — uuid — nullable — references public.category_templates.id
name — text — not null
description — text — nullable
is_custom — boolean — not null — default: true
is_active — boolean — not null — default: true
created_at — timestamptz — not null — default: timezone('utc', now())
updated_at — timestamptz — not null — default: timezone('utc', now())
Primary key: id
Foreign keys: merchant_categories.shop_id → public.shops.id
merchant_items (rls: enabled)

id — uuid — not null — default: extensions.uuid_generate_v4()
shop_id — uuid — not null — references public.shops.id
template_id — uuid — nullable — references public.item_templates.id
name — text — nullable
description — text — nullable
barcode — text — nullable
image_url — text — nullable
sku — text — nullable
price_cents — integer — not null — default: 0 — check: price_cents >= 0
currency — text — not null — default: 'PKR'
is_active — boolean — not null — default: true
is_custom — boolean — not null — default: true
created_at — timestamptz — not null — default: timezone('utc', now())
updated_at — timestamptz — not null — default: timezone('utc', now())
created_by — uuid — nullable — default: auth.uid()
last_updated_by — jsonb — nullable
Primary key: id
Foreign keys: merchant_items.shop_id → public.shops.id
merchant_item_categories (rls: enabled)

merchant_item_id — uuid — not null — references public.merchant_items.id
merchant_category_id — uuid — not null — references public.merchant_categories.id
sort_order — integer — not null — default: 0
Primary key: (merchant_item_id, merchant_category_id)
audit_logs (rls: enabled)

id — uuid — not null — default: extensions.uuid_generate_v4()
shop_id — uuid — not null — references public.shops.id
merchant_item_id — uuid — nullable — references public.merchant_items.id
actor — jsonb — not null
action_type — text — not null
changed_fields — jsonb — not null — default: '{}'
source — text — not null — default: 'manual'
created_at — timestamptz — not null — default: timezone('utc', now())
Primary key: id
Foreign keys: audit_logs.shop_id → public.shops.id, audit_logs.merchant_item_id → public.merchant_items.id
spatial_ref_sys (rls: disabled)

srid — integer — not null — PK — check: srid > 0 AND srid <= 998999
auth_name — varchar — nullable
auth_srid — integer — nullable
srtext — varchar — nullable
proj4text — varchar — nullable
Primary key: srid
Note: Standard PostGIS spatial_ref_sys table (many rows)
shop_delivery_areas (rls: enabled)

id — uuid — not null — default: extensions.uuid_generate_v4()
shop_id — uuid — not null — references public.shops.id
label — text — nullable
geom — geometry — not null
created_at — timestamptz — not null — default: timezone('utc', now())
updated_at — timestamptz — not null — default: timezone('utc', now())
Primary key: id
Foreign keys: shop_delivery_areas.shop_id → public.shops.id
delivery_runners (rls: enabled)

id — uuid — not null — default: extensions.uuid_generate_v4()
shop_id — uuid — not null — references public.shops.id
name — text — not null
phone_number — text — not null
created_at — timestamptz — not null — default: timezone('utc', now())
updated_at — timestamptz — not null — default: timezone('utc', now())
Primary key: id
Foreign keys: delivery_runners.shop_id → public.shops.id
shop_delivery_logic (rls: enabled) — comment: Stores delivery logic settings...

id — uuid — not null — default: extensions.uuid_generate_v4()
shop_id — uuid — not null — unique — references public.shops.id
minimum_order_value — numeric — not null — default: 200.00 — check: > 0
small_order_surcharge — numeric — not null — default: 40.00 — check: >= 0
least_order_value — numeric — not null — default: 100.00 — check: > 0
created_at — timestamptz — not null — default: timezone('utc', now())
updated_at — timestamptz — not null — default: timezone('utc', now())
distance_mode — text — not null — default: 'auto' — check: IN {auto, custom}
max_delivery_fee — numeric — not null — default: 130.00
distance_tiers — jsonb — not null — default: JSON array of tiers
beyond_tier_fee_per_unit — numeric — not null — default: 10.00
beyond_tier_distance_unit — numeric — not null — default: 250.00
free_delivery_threshold — numeric — not null — default: 800.00
free_delivery_radius — numeric — not null — default: 1000.00
Primary key: id
Foreign keys: shop_delivery_logic.shop_id → public.shops.id




Triggers in public (developer-friendly)
I queried the DB for triggers on public.* tables and returned trigger name, table, and definition. Below are the triggers found with concise details your web developer can use.*

update_consumer_addresses_updated_at — consumer_addresses

Definition: CREATE TRIGGER update_consumer_addresses_updated_at BEFORE UPDATE ON public.consumer_addresses FOR EACH ROW EXECUTE FUNCTION update_consumer_addresses_updated_at()
delivery_runners_touch — delivery_runners

Definition: CREATE TRIGGER delivery_runners_touch BEFORE UPDATE ON public.delivery_runners FOR EACH ROW EXECUTE FUNCTION touch_updated_at()
update_merchant_accounts_updated_at — merchant_accounts

Definition: CREATE TRIGGER update_merchant_accounts_updated_at BEFORE UPDATE ON public.merchant_accounts FOR EACH ROW EXECUTE FUNCTION update_merchant_accounts_updated_at()
merchant_categories_touch — merchant_categories

Definition: CREATE TRIGGER merchant_categories_touch BEFORE UPDATE ON public.merchant_categories FOR EACH ROW EXECUTE FUNCTION touch_updated_at()
merchant_items_actor — merchant_items

Definition: CREATE TRIGGER merchant_items_actor BEFORE UPDATE ON public.merchant_items FOR EACH ROW EXECUTE FUNCTION set_inventory_last_updated_actor()
merchant_items_log_delete — merchant_items

Definition: CREATE TRIGGER merchant_items_log_delete AFTER DELETE ON public.merchant_items FOR EACH ROW EXECUTE FUNCTION log_inventory_change()
merchant_items_log_insert — merchant_items

Definition: CREATE TRIGGER merchant_items_log_insert AFTER INSERT ON public.merchant_items FOR EACH ROW EXECUTE FUNCTION log_inventory_change()
merchant_items_log_update — merchant_items

Definition: CREATE TRIGGER merchant_items_log_update AFTER UPDATE ON public.merchant_items FOR EACH ROW EXECUTE FUNCTION log_inventory_change()
merchant_items_touch — merchant_items

Definition: CREATE TRIGGER merchant_items_touch BEFORE UPDATE ON public.merchant_items FOR EACH ROW EXECUTE FUNCTION touch_updated_at()
shop_delivery_areas_prevent_overlap — shop_delivery_areas

Definition: CREATE TRIGGER shop_delivery_areas_prevent_overlap BEFORE INSERT OR UPDATE ON public.shop_delivery_areas FOR EACH ROW EXECUTE FUNCTION prevent_shop_delivery_area_overlap()
shop_delivery_areas_touch — shop_delivery_areas

Definition: CREATE TRIGGER shop_delivery_areas_touch BEFORE UPDATE ON public.shop_delivery_areas FOR EACH ROW EXECUTE FUNCTION touch_updated_at()
shop_delivery_logic_touch — shop_delivery_logic

Definition: CREATE TRIGGER shop_delivery_logic_touch BEFORE UPDATE ON public.shop_delivery_logic FOR EACH ROW EXECUTE FUNCTION touch_updated_at()
auto_create_delivery_logic — shops

Definition: CREATE TRIGGER auto_create_delivery_logic AFTER INSERT ON public.shops FOR EACH ROW EXECUTE FUNCTION create_default_delivery_logic()
update_shops_updated_at — shops

Definition: CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON public.shops FOR EACH ROW EXECUTE FUNCTION update_shops_updated_at()
update_user_profiles_updated_at — user_profiles

Definition: CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()




Functions in public (developer-friendly)
I queried pg_proc for the public schema and retrieved the functions referenced by your triggers. Below are each function's signature, attributes, and full definition (ready for review).

create_default_delivery_logic()

Returns: trigger

Language: plpgsql

Security definer: no

Volatility: volatile

Definition: CREATE OR REPLACE FUNCTION public.create_default_delivery_logic() RETURNS trigger LANGUAGE plpgsql AS $function$ BEGIN INSERT INTO public.shop_delivery_logic ( shop_id, minimum_order_value, small_order_surcharge, least_order_value, distance_mode, max_delivery_fee, distance_tiers, beyond_tier_fee_per_unit, beyond_tier_distance_unit, free_delivery_threshold, free_delivery_radius ) VALUES ( NEW.id, 200.00, 40.00, 100.00, 'auto', 130.00, '[ {"max_distance": 200, "fee": 20}, {"max_distance": 400, "fee": 30}, {"max_distance": 600, "fee": 40}, {"max_distance": 800, "fee": 50}, {"max_distance": 1000, "fee": 60} ]'::jsonb, 10.00, 250.00, 800.00, 1000.00 ) ON CONFLICT (shop_id) DO NOTHING;

RETURN NEW; END; $function$

log_inventory_change()

Returns: trigger

Language: plpgsql

Security definer: no

Volatility: volatile

Definition: CREATE OR REPLACE FUNCTION public.log_inventory_change() RETURNS trigger LANGUAGE plpgsql AS $function$ DECLARE diff JSONB := '{}'::JSONB; actor_id UUID := auth.uid(); actor_role TEXT := current_setting('request.jwt.claim.role', true); actor_email TEXT := current_setting('request.jwt.claim.email', true); source_hint TEXT := COALESCE((current_setting('request.headers', true)::JSON ->> 'x-change-source'), 'manual'); target_shop UUID; BEGIN IF TG_OP = 'DELETE' THEN RETURN OLD; ELSIF TG_OP = 'INSERT' THEN diff := jsonb_strip_nulls(jsonb_build_object( 'sku', jsonb_build_object('from', NULL, 'to', NEW.sku), 'price_cents', jsonb_build_object('from', NULL, 'to', NEW.price_cents), 'is_active', jsonb_build_object('from', NULL, 'to', NEW.is_active) )); target_shop := NEW.shop_id; ELSIF TG_OP = 'UPDATE' THEN IF NEW.sku IS DISTINCT FROM OLD.sku THEN diff := diff || jsonb_build_object('sku', jsonb_build_object('from', OLD.sku, 'to', NEW.sku)); END IF; IF NEW.price_cents IS DISTINCT FROM OLD.price_cents THEN diff := diff || jsonb_build_object('price_cents', jsonb_build_object('from', OLD.price_cents, 'to', NEW.price_cents)); END IF; IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN diff := diff || jsonb_build_object('is_active', jsonb_build_object('from', OLD.is_active, 'to', NEW.is_active)); END IF; IF NEW.description IS DISTINCT FROM OLD.description THEN diff := diff || jsonb_build_object('description', jsonb_build_object('from', OLD.description, 'to', NEW.description)); END IF; IF NEW.template_id IS DISTINCT FROM OLD.template_id THEN diff := diff || jsonb_build_object('template_id', jsonb_build_object('from', OLD.template_id, 'to', NEW.template_id)); END IF; target_shop := NEW.shop_id; END IF;

IF TG_OP = 'UPDATE' AND diff = '{}'::JSONB THEN RETURN NEW; END IF;

INSERT INTO public.audit_logs ( shop_id, merchant_item_id, actor, action_type, changed_fields, source ) VALUES ( target_shop, NEW.id, jsonb_strip_nulls(jsonb_build_object( 'id', actor_id, 'role', actor_role, 'email', actor_email )), TG_OP, diff, source_hint );

RETURN NEW; END; $function$

prevent_shop_delivery_area_overlap()

Returns: trigger

Language: plpgsql

Security definer: no

Volatility: volatile

Definition: CREATE OR REPLACE FUNCTION public.prevent_shop_delivery_area_overlap() RETURNS trigger LANGUAGE plpgsql AS $function$ BEGIN IF NEW.geom IS NULL THEN RAISE EXCEPTION 'Delivery area geometry is required'; END IF;

IF NOT ST_IsValid(NEW.geom) THEN RAISE EXCEPTION 'Delivery area geometry is invalid: %', ST_IsValidReason(NEW.geom); END IF;

IF EXISTS ( SELECT 1 FROM public.shop_delivery_areas existing WHERE existing.shop_id = NEW.shop_id AND (NEW.id IS NULL OR existing.id <> NEW.id) AND ST_Intersects(existing.geom, NEW.geom) ) THEN RAISE EXCEPTION 'Delivery areas cannot overlap for the same shop.'; END IF;

RETURN NEW; END; $function$

set_inventory_last_updated_actor()

Returns: trigger

Language: plpgsql

Security definer: no

Volatility: volatile

Definition: CREATE OR REPLACE FUNCTION public.set_inventory_last_updated_actor() RETURNS trigger LANGUAGE plpgsql AS $function$ DECLARE actor_id UUID; actor_role TEXT; actor_email TEXT; BEGIN actor_id := auth.uid(); actor_role := current_setting('request.jwt.claim.role', true); actor_email := current_setting('request.jwt.claim.email', true);

IF actor_id IS NOT NULL THEN NEW.last_updated_by := jsonb_build_object( 'id', actor_id, 'role', actor_role, 'email', actor_email ); END IF;

RETURN NEW; END; $function$

touch_updated_at()

Returns: trigger
Language: plpgsql
Security definer: no
Volatility: volatile
Definition: CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $function$ BEGIN NEW.updated_at = timezone('utc'::TEXT, now()); RETURN NEW; END; $function$
update_consumer_addresses_updated_at()

Returns: trigger
Language: plpgsql
Security definer: no
Volatility: volatile
Definition: CREATE OR REPLACE FUNCTION public.update_consumer_addresses_updated_at() RETURNS trigger LANGUAGE plpgsql AS $function$ BEGIN NEW.updated_at = timezone('utc'::text, now()); RETURN NEW; END; $function$
update_merchant_accounts_updated_at()

Returns: trigger
Language: plpgsql
Security definer: no
Volatility: volatile
Definition: CREATE OR REPLACE FUNCTION public.update_merchant_accounts_updated_at() RETURNS trigger LANGUAGE plpgsql AS $function$ BEGIN NEW.updated_at = timezone('utc'::text, now()); RETURN NEW; END; $function$
update_shops_updated_at()

Returns: trigger
Language: plpgsql
Security definer: no
Volatility: volatile
Definition: CREATE OR REPLACE FUNCTION public.update_shops_updated_at() RETURNS trigger LANGUAGE plpgsql AS $function$ BEGIN NEW.updated_at = timezone('utc'::text, now()); RETURN NEW; END; $function$
update_updated_at_column()

Returns: trigger
Language: plpgsql
Security definer: yes (SECURITY DEFINER, search_path set to public)
Volatility: volatile
Definition: CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $function$