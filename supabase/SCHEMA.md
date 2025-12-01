Public schema — tables and fields
Tables
user_profiles

PK: id (uuid)
notable: email, name, role, created_at, updated_at
FKs:
user_profiles.id → auth.users.id
consumer_addresses

PK: id (uuid)
notable: user_id, title (home/office), street_address, city, region, latitude, longitude, formatted_address, created_at, updated_at
FKs:
consumer_addresses.user_id → auth.users.id
referenced by: orders.consumer_address_id → public.consumer_addresses.id
merchant_accounts

PK: id (uuid)
notable: user_id (unique), shop_type, number_of_shops, status, verification fields, created_at, updated_at
FKs:
merchant_accounts.user_id → auth.users.id
referenced by: shops.merchant_id → public.merchant_accounts.id
shops

PK: id (uuid)
notable: merchant_id, name, description, shop_type, address, latitude, longitude, tags (text[]), is_open, opening_hours (jsonb), holidays (jsonb), open_status_mode, created_at, updated_at
FKs:
shops.merchant_id → public.merchant_accounts.id
referenced by:
merchant_items.shop_id → public.shops.id
shop_delivery_logic.shop_id → public.shops.id
reviews.shop_id → public.shops.id
orders.shop_id → public.shops.id
merchant_item_embeddings.shop_id → public.shops.id
delivery_runners.shop_id → public.shops.id
shop_delivery_areas.shop_id → public.shops.id
audit_logs.shop_id → public.shops.id
merchant_categories.shop_id → public.shops.id
category_templates

PK: id (uuid)
notable: name, description, created_at, updated_at
FKs:
referenced by: merchant_categories.template_id → public.category_templates.id
item_templates

PK: id (uuid)
notable: name, barcode, description, image_url, default_unit, name_normalized (generated lower-case), created_at, updated_at
FKs:
referenced by: merchant_items.template_id → public.item_templates.id
merchant_categories

PK: id (uuid)
notable: shop_id, template_id (nullable), name, is_custom, is_active, created_at, updated_at
FKs:
merchant_categories.shop_id → public.shops.id
merchant_categories.template_id → public.category_templates.id
referenced by: merchant_item_categories.merchant_category_id → public.merchant_categories.id
merchant_items

PK: id (uuid)
notable: shop_id, template_id (nullable), name, description, barcode, sku, price_cents, currency, is_active, is_custom, created_by (auth.uid()), times_sold, total_revenue_cents, created_at, updated_at
FKs:
merchant_items.shop_id → public.shops.id
merchant_items.template_id → public.item_templates.id
referenced by:
merchant_item_categories.merchant_item_id → public.merchant_items.id
audit_logs.merchant_item_id → public.merchant_items.id
order_items.merchant_item_id → public.merchant_items.id
merchant_item_embeddings.merchant_item_id → public.merchant_items.id
merchant_item_categories (join table)

PK: (merchant_item_id, merchant_category_id)
notable: sort_order
FKs:
merchant_item_categories.merchant_item_id → public.merchant_items.id
merchant_item_categories.merchant_category_id → public.merchant_categories.id
audit_logs

PK: id (uuid)
notable: shop_id, merchant_item_id (nullable), actor (jsonb), action_type, changed_fields (jsonb), source, created_at
FKs:
audit_logs.shop_id → public.shops.id
audit_logs.merchant_item_id → public.merchant_items.id
spatial_ref_sys

PK: srid (integer)
notable: SRID reference table (PostGIS)
rls_enabled: false
shop_delivery_areas

PK: id (uuid)
notable: shop_id, label, geom (geometry), created_at, updated_at
FKs:
shop_delivery_areas.shop_id → public.shops.id
delivery_runners

PK: id (uuid)
notable: shop_id, name, phone_number, created_at, updated_at
FKs:
delivery_runners.shop_id → public.shops.id
referenced by: orders.delivery_runner_id → public.delivery_runners.id
shop_delivery_logic

PK: id (uuid)
notable: shop_id (unique), minimum_order_value, small_order_surcharge, least_order_value, distance_mode, max_delivery_fee, distance_tiers (jsonb), beyond_tier_fee_per_unit, beyond_tier_distance_unit, free_delivery_threshold, free_delivery_radius, created_at, updated_at
FKs:
shop_delivery_logic.shop_id → public.shops.id
orders

PK: id (uuid)
notable: order_number (unique), shop_id (nullable), user_id, consumer_address_id, delivery_runner_id (nullable), status (order_status enum), subtotal_cents, delivery_fee_cents, surcharge_cents, total_cents, payment_method (enum), delivery_address (jsonb snapshot), timestamps for status transitions, timing analytics columns, customer_name/email/phone, created_at, updated_at
FKs:
orders.shop_id → public.shops.id
orders.user_id → auth.users.id
orders.consumer_address_id → public.consumer_addresses.id
orders.delivery_runner_id → public.delivery_runners.id
orders.cancelled_by → auth.users.id
referenced by:
order_items.order_id → public.orders.id
reviews.order_id → public.orders.id
webhook_events.order_id → public.orders.id
webhook_dead_letters.order_id → public.orders.id
notification_audit_log.order_id → public.orders.id
order_items

PK: id (uuid)
notable: order_id, merchant_item_id (nullable), item_name, item_description, item_image_url, item_price_cents, quantity, subtotal_cents, created_at
FKs:
order_items.order_id → public.orders.id
order_items.merchant_item_id → public.merchant_items.id
reviews

PK: id (uuid)
notable: user_id, shop_id, order_id (nullable), rating (1-5), review_text, created_at, updated_at
FKs:
reviews.user_id → auth.users.id
reviews.shop_id → public.shops.id
reviews.order_id → public.orders.id
notification_preferences

PK: id (uuid)
notable: user_id, role (consumer/merchant), allow_push_notifications (boolean), created_at, updated_at
FKs:
notification_preferences.user_id → auth.users.id
device_tokens

PK: id (uuid)
notable: user_id, token (unique), platform (ios/android), created_at, updated_at
FKs:
device_tokens.user_id → auth.users.id
webhook_events

PK: id (uuid)
notable: event_id (unique), order_id, event_type (INSERT/UPDATE/DELETE), status (pending/processing/completed/failed), payload (jsonb), processed_at, error_message, created_at
FKs:
webhook_events.order_id → public.orders.id
webhook_dead_letters

PK: id (uuid)
notable: order_id (nullable), event_type, payload (jsonb), error_message, error_stack, retry_count, last_retry_at, created_at
FKs:
webhook_dead_letters.order_id → public.orders.id
notification_audit_log

PK: id (uuid)
notable: order_id, user_id, role (consumer/merchant), notification_type, title, body, fcm_token, platform, status (sent/failed/pending), error_message, sent_at, created_at
FKs:
notification_audit_log.order_id → public.orders.id
notification_audit_log.user_id → auth.users.id
user_preferences

PK: id (uuid)
notable: user_id, preference_type (brand/item/category/shop/dietary), entity_type (item/shop/category), entity_id (uuid nullable), entity_name (denormalized), preference_value (prefers/avoids/allergic_to), confidence_score (0.0-1.0), source (explicit/inferred_from_order/conversation), context (jsonb), created_at, updated_at
FKs:
user_preferences.user_id → auth.users.id
referenced by: user_preference_embeddings.preference_id → public.user_preferences.id
user_preference_embeddings

PK: id (uuid)
notable: user_id, preference_id, embedding (vector), metadata (jsonb), created_at
FKs:
user_preference_embeddings.user_id → auth.users.id
user_preference_embeddings.preference_id → public.user_preferences.id
merchant_item_embeddings

PK: id (uuid)
notable: merchant_item_id (unique), shop_id, embedding (vector), search_text, created_at, updated_at
FKs:
merchant_item_embeddings.merchant_item_id → public.merchant_items.id
merchant_item_embeddings.shop_id → public.shops.id
Key relationship graph (textual)
auth.users

referenced by: user_profiles, consumer_addresses, merchant_accounts, orders.user_id, orders.cancelled_by, order-related tables (order_items via created_by references only), reviews.user_id, notification_preferences, device_tokens, notification_audit_log, user_preferences, user_preference_embeddings, user_preference_embeddings.user_id, merchant_accounts.user_id
merchant_accounts (1) → shops (many)
shops (1) → merchant_items (many)
shops (1) → merchant_categories (many)
shops (1) → shop_delivery_logic (1, unique)
shops (1) → delivery_runners (many)
shops (1) → shop_delivery_areas (many)
shops (1) → reviews (many)
shops (1) → orders (many)
merchant_items (1) ↔ merchant_categories via merchant_item_categories (many-to-many join)
merchant_items (1) → merchant_item_embeddings (1)
merchant_items (1) → order_items (many)
orders (1) → order_items (many)
orders (1) → webhook_events, webhook_dead_letters, notification_audit_log (many)
user_preferences (1) → user_preference_embeddings (many)


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



RLS policies in public schema — summary
Below are the Row-Level Security policies currently defined for tables in the public schema. I’ve grouped them by table and included action (SELECT/INSERT/UPDATE/DELETE/ALL), roles, and the policy expression(s).

Notes:

Role column shows the role the policy applies to (many are to public).
“Definition” is the USING expression (controls visibility/which rows can be targeted).
“Check” is the WITH CHECK expression (controls allowed row values on INSERT/UPDATE).
If you want me to produce SQL to recreate, modify, or remove any policy, tell me which one(s) and I’ll provide or execute the DDL (destructive actions require confirmation).
user_profiles

"Users can view own profile" — SELECT — Roles: public
USING: auth.uid() = id
"Users can update own profile" — UPDATE — Roles: public
USING: auth.uid() = id
WITH CHECK: auth.uid() = id
"Users can insert own profile" — INSERT — Roles: public
WITH CHECK: auth.uid() = id
consumer_addresses

"Users can view their own addresses" — SELECT — Roles: public
USING: auth.uid() = user_id
"Users can insert their own addresses" — INSERT — Roles: public
WITH CHECK: auth.uid() = user_id
"Users can update their own addresses" — UPDATE — Roles: public
USING: auth.uid() = user_id
WITH CHECK: auth.uid() = user_id
"Users can delete their own addresses" — DELETE — Roles: public
USING: auth.uid() = user_id
merchant_accounts

"Users can view their own merchant account" — SELECT — Roles: public
USING: auth.uid() = user_id
"Users can insert their own merchant account" — INSERT — Roles: public
WITH CHECK: auth.uid() = user_id
"Users can update their own merchant account" — UPDATE — Roles: public
USING: auth.uid() = user_id
WITH CHECK: auth.uid() = user_id
shops

"Users can view their own shops" — SELECT — Roles: public
USING: EXISTS (SELECT 1 FROM merchant_accounts WHERE merchant_accounts.id = shops.merchant_id AND merchant_accounts.user_id = auth.uid())
"Users can insert their own shops" — INSERT — Roles: public
WITH CHECK: EXISTS (SELECT 1 FROM merchant_accounts WHERE merchant_accounts.id = shops.merchant_id AND merchant_accounts.user_id = auth.uid())
"Users can update their own shops" — UPDATE — Roles: public
USING: EXISTS (SELECT 1 FROM merchant_accounts WHERE merchant_accounts.id = shops.merchant_id AND merchant_accounts.user_id = auth.uid())
WITH CHECK: same as USING
"Users can delete their own shops" — DELETE — Roles: public
USING: EXISTS (SELECT 1 FROM merchant_accounts WHERE merchant_accounts.id = shops.merchant_id AND merchant_accounts.user_id = auth.uid())
merchant_item_categories

"merchant_item_categories_modify" — ALL — Roles: public
USING: EXISTS (SELECT 1 FROM merchant_items mi JOIN shops s ON s.id = mi.shop_id JOIN merchant_accounts ma ON ma.id = s.merchant_id WHERE mi.id = merchant_item_categories.merchant_item_id AND ma.user_id = auth.uid())
WITH CHECK: same as USING
category_templates

"category_templates_read" — SELECT — Roles: public
USING: true
item_templates

"item_templates_read" — SELECT — Roles: public
USING: true
merchant_categories

"merchant_categories_select" — SELECT — Roles: public
USING: EXISTS (SELECT 1 FROM shops s JOIN merchant_accounts ma ON ma.id = s.merchant_id WHERE s.id = merchant_categories.shop_id AND ma.user_id = auth.uid())
"merchant_categories_modify" — ALL — Roles: public
USING: EXISTS (SELECT 1 FROM shops s JOIN merchant_accounts ma ON ma.id = s.merchant_id WHERE s.id = merchant_categories.shop_id AND ma.user_id = auth.uid())
WITH CHECK: same as USING
merchant_items

"merchant_items_select" — SELECT — Roles: public
USING: EXISTS (SELECT 1 FROM shops s JOIN merchant_accounts ma ON ma.id = s.merchant_id WHERE s.id = merchant_items.shop_id AND ma.user_id = auth.uid())
"merchant_items_modify" — ALL — Roles: public
USING: EXISTS (SELECT 1 FROM shops s JOIN merchant_accounts ma ON ma.id = s.merchant_id WHERE s.id = merchant_items.shop_id AND ma.user_id = auth.uid())
WITH CHECK: same as USING
merchant_item_categories (select)

"merchant_item_categories_select" — SELECT — Roles: public
USING: EXISTS (SELECT 1 FROM merchant_items mi JOIN shops s ON s.id = mi.shop_id JOIN merchant_accounts ma ON ma.id = s.merchant_id WHERE mi.id = merchant_item_categories.merchant_item_id AND ma.user_id = auth.uid())
audit_logs

"audit_logs_select" — SELECT — Roles: public
USING: EXISTS (SELECT 1 FROM shops s JOIN merchant_accounts ma ON ma.id = s.merchant_id WHERE s.id = audit_logs.shop_id AND ma.user_id = auth.uid())
"audit_logs_insert" — INSERT — Roles: public
WITH CHECK: EXISTS (SELECT 1 FROM shops s JOIN merchant_accounts ma ON ma.id = s.merchant_id WHERE s.id = audit_logs.shop_id AND ma.user_id = auth.uid())
shop_delivery_areas

"Shop owners can view delivery areas" — SELECT — Roles: public
USING: EXISTS (SELECT 1 FROM shops JOIN merchant_accounts ON merchant_accounts.id = shops.merchant_id WHERE shops.id = shop_delivery_areas.shop_id AND merchant_accounts.user_id = auth.uid())
"Shop owners can insert delivery areas" — INSERT — Roles: public
WITH CHECK: EXISTS (SELECT 1 FROM shops JOIN merchant_accounts ON merchant_accounts.id = shops.merchant_id WHERE shops.id = shop_delivery_areas.shop_id AND merchant_accounts.user_id = auth.uid())
"Shop owners can update delivery areas" — UPDATE — Roles: public
USING: EXISTS (same as above)
WITH CHECK: EXISTS (same as above)
"Shop owners can delete delivery areas" — DELETE — Roles: public
USING: EXISTS (same as above)
shops (public-read)

"Anyone can view shops" — SELECT — Roles: public
USING: true
shop_delivery_areas (public-read)

"Anyone can view delivery areas" — SELECT — Roles: public
USING: true
delivery_runners

"Shop owners can view delivery runners" — SELECT — Roles: public
USING: EXISTS (SELECT 1 FROM shops JOIN merchant_accounts ON merchant_accounts.id = shops.merchant_id WHERE shops.id = delivery_runners.shop_id AND merchant_accounts.user_id = auth.uid())
"Shop owners can insert delivery runners" — INSERT — Roles: public
WITH CHECK: EXISTS (same as USING condition)
"Shop owners can update delivery runners" — UPDATE — Roles: public
USING: EXISTS (same as USING condition)
WITH CHECK: EXISTS (same as USING condition)
"Shop owners can delete delivery runners" — DELETE — Roles: public
USING: EXISTS (same as USING condition)
shop_delivery_logic

"Shop owners can view delivery logic" — SELECT — Roles: public
USING: EXISTS (SELECT 1 FROM shops JOIN merchant_accounts ON merchant_accounts.id = shops.merchant_id WHERE shops.id = shop_delivery_logic.shop_id AND merchant_accounts.user_id = auth.uid())
"Shop owners can insert delivery logic" — INSERT — Roles: public
WITH CHECK: EXISTS (same as USING condition)
"Shop owners can update delivery logic" — UPDATE — Roles: public
USING: EXISTS (same as USING condition)
WITH CHECK: EXISTS (same as USING condition)
"Anyone can view delivery logic" — SELECT — Roles: public
USING: true
merchant_categories / merchant_items public visibility rules

"Anyone can view active items from open shops" — SELECT on merchant_items — Roles: public
USING: is_active = true AND EXISTS (SELECT 1 FROM shops s WHERE s.id = merchant_items.shop_id AND s.is_open = true)
"Anyone can view active categories from open shops" — SELECT on merchant_categories — Roles: public
USING: is_active = true AND EXISTS (SELECT 1 FROM shops s WHERE s.id = merchant_categories.shop_id AND s.is_open = true)
"Anyone can view item categories from open shops" — SELECT on merchant_item_categories — Roles: public
USING: EXISTS (SELECT 1 FROM merchant_items mi JOIN shops s ON s.id = mi.shop_id WHERE mi.id = merchant_item_categories.merchant_item_id AND mi.is_active = true AND s.is_open = true)
orders

"Consumers can view their own orders" — SELECT — Roles: public
USING: auth.uid() = user_id
"Consumers can insert their own orders" — INSERT — Roles: public
WITH CHECK: auth.uid() = user_id
"Merchants can view orders for their shops" — SELECT — Roles: public
USING: EXISTS (SELECT 1 FROM shops s JOIN merchant_accounts ma ON ma.id = s.merchant_id WHERE s.id = orders.shop_id AND ma.user_id = auth.uid())
"Merchants can update orders for their shops" — UPDATE — Roles: public
USING: EXISTS (same as above)
WITH CHECK: EXISTS (same as above)
order_items

"Consumers can view their own order items" — SELECT — Roles: public
USING: EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
"Consumers can insert order items for their orders" — INSERT — Roles: public
WITH CHECK: EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
"Merchants can view order items for their shops" — SELECT — Roles: public
USING: EXISTS (SELECT 1 FROM orders o JOIN shops s ON s.id = o.shop_id JOIN merchant_accounts ma ON ma.id = s.merchant_id WHERE o.id = order_items.order_id AND ma.user_id = auth.uid())