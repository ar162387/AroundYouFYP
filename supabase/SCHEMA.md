Public schema — tables and fields
Below are the tables found in the public schema with their columns and any notable constraints/defaults/comments. If you want DDL for any specific table or to export this as SQL, tell me which table(s).

user_profiles
id (uuid) — PK
email (text) — nullable
name (text) — nullable
role (text) — default 'consumer'; check role ∈ {consumer, merchant, admin}
created_at (timestamptz) — default now()
updated_at (timestamptz) — default now()
FK: public.user_profiles.id → auth.users.id
consumer_addresses
id (uuid) — PK, default extensions.uuid_generate_v4()
user_id (uuid) — FK → auth.users.id
title (text) — nullable; check title ∈ {home, office}; comment: optional address title (unique per user)
street_address (text) — comment: street address without city/region
city (text)
region (text) — nullable
latitude (numeric)
longitude (numeric)
landmark (text) — nullable; comment: optional landmark or flat/house number
formatted_address (text) — nullable
created_at (timestamptz) — default timezone('utc', now())
updated_at (timestamptz) — default timezone('utc', now())
merchant_accounts
id (uuid) — PK, default extensions.uuid_generate_v4()
user_id (uuid) — unique, FK → auth.users.id
shop_type (text) — check shop_type ∈ {grocery, meat, vegetable, mart, other}
number_of_shops (text) — check ∈ {1, 2, 3+}
status (text) — default 'none'; check ∈ {none, pending, verified}
created_at (timestamptz) — default timezone('utc', now())
updated_at (timestamptz) — default timezone('utc', now())
Comment: stores merchant account info; FK referenced by public.shops.merchant_id
shops
id (uuid) — PK, default extensions.uuid_generate_v4()
merchant_id (uuid) — FK → public.merchant_accounts.id; comment: owner merchant account
name (text)
description (text)
shop_type (text) — check ∈ {Grocery, Meat, Vegetable, Stationery, Dairy}
address (text)
latitude (double precision) — comment: shop location latitude
longitude (double precision) — comment: shop location longitude
image_url (text) — nullable
tags (text[]) — nullable; default '{}'
is_open (boolean) — nullable; default true
created_at (timestamptz) — default timezone('utc', now())
updated_at (timestamptz) — default timezone('utc', now())
Comment: stores shop information
category_templates
id (uuid) — PK, default extensions.uuid_generate_v4()
name (text)
description (text) — nullable
created_at (timestamptz) — default timezone('utc', now())
updated_at (timestamptz) — default timezone('utc', now())
item_templates
id (uuid) — PK, default extensions.uuid_generate_v4()
name (text)
barcode (text) — nullable
description (text) — nullable
image_url (text) — nullable
default_unit (text) — nullable
created_at (timestamptz) — default timezone('utc', now())
updated_at (timestamptz) — default timezone('utc', now())
name_normalized (text) — generated, unique, default lower(trim(both from name))
merchant_categories
id (uuid) — PK, default extensions.uuid_generate_v4()
shop_id (uuid) — FK → public.shops.id
template_id (uuid) — nullable; FK → public.category_templates.id
name (text)
description (text) — nullable
is_custom (boolean) — default true
is_active (boolean) — default true
created_at (timestamptz) — default timezone('utc', now())
updated_at (timestamptz) — default timezone('utc', now())
merchant_items
id (uuid) — PK, default extensions.uuid_generate_v4()
shop_id (uuid) — FK → public.shops.id
template_id (uuid) — nullable; FK → public.item_templates.id
name (text) — nullable
description (text) — nullable
barcode (text) — nullable
image_url (text) — nullable
sku (text) — nullable
price_cents (integer) — default 0; check price_cents >= 0
currency (text) — default 'PKR'
is_active (boolean) — default true
is_custom (boolean) — default true
times_sold (integer) — default 0; check >= 0; incremented when order is delivered
total_revenue_cents (bigint) — default 0; check >= 0; total revenue from this item
created_at (timestamptz) — default timezone('utc', now())
updated_at (timestamptz) — default timezone('utc', now())
created_by (uuid) — nullable; default auth.uid()
last_updated_by (jsonb) — nullable
merchant_item_categories
merchant_item_id (uuid) — PK part; FK → public.merchant_items.id
merchant_category_id (uuid) — PK part; FK → public.merchant_categories.id
sort_order (integer) — default 0
audit_logs
id (uuid) — PK, default extensions.uuid_generate_v4()
shop_id (uuid) — FK → public.shops.id
merchant_item_id (uuid) — nullable; FK → public.merchant_items.id
actor (jsonb)
action_type (text)
changed_fields (jsonb) — default '{}'::jsonb
source (text) — default 'manual'
created_at (timestamptz) — default timezone('utc', now())
spatial_ref_sys
srid (integer) — PK; check srid > 0 AND srid <= 998999
auth_name (varchar) — nullable
auth_srid (integer) — nullable
srtext (varchar) — nullable
proj4text (varchar) — nullable
Note: rls_enabled = false (standard spatial_ref_sys table)
shop_delivery_areas
id (uuid) — PK, default extensions.uuid_generate_v4()
shop_id (uuid) — FK → public.shops.id
label (text) — nullable
geom (geometry) — user-defined type
created_at (timestamptz) — default timezone('utc', now())
updated_at (timestamptz) — default timezone('utc', now())
delivery_runners
id (uuid) — PK, default extensions.uuid_generate_v4()
shop_id (uuid) — FK → public.shops.id
name (text)
phone_number (text)
created_at (timestamptz) — default timezone('utc', now())
updated_at (timestamptz) — default timezone('utc', now())
shop_delivery_logic
id (uuid) — PK, default extensions.uuid_generate_v4()
shop_id (uuid) — unique, FK → public.shops.id
minimum_order_value (numeric) — default 200.00; check > 0; comment about surcharge below threshold
small_order_surcharge (numeric) — default 40.00; check >= 0
least_order_value (numeric) — default 100.00; check > 0; hard floor for order acceptance
created_at (timestamptz) — default timezone('utc', now())
updated_at (timestamptz) — default timezone('utc', now())
distance_mode (text) — default 'auto'; check ∈ {auto, custom}
max_delivery_fee (numeric) — default 130.00; check > 0
distance_tiers (jsonb) — default JSONB array of {fee, max_distance} tiers
beyond_tier_fee_per_unit (numeric) — default 10.00; check >= 0
beyond_tier_distance_unit (numeric) — default 250.00; check > 0
free_delivery_threshold (numeric) — default 800.00; check >= 0
free_delivery_radius (numeric) — default 1000.00; check >= 0
Comment: delivery logic settings including order value and distance tiers
orders
id (uuid) — PK, default extensions.uuid_generate_v4()
order_number (text) — unique, auto-generated format: ORD-YYYYMMDD-NNNN
shop_id (uuid) — FK → public.shops.id
user_id (uuid) — FK → auth.users.id
consumer_address_id (uuid) — FK → public.consumer_addresses.id
delivery_runner_id (uuid) — nullable; FK → public.delivery_runners.id
status (order_status) — enum: pending, confirmed, out_for_delivery, delivered, cancelled; default 'pending'
subtotal_cents (integer) — check >= 0
delivery_fee_cents (integer) — default 0; check >= 0
surcharge_cents (integer) — default 0; check >= 0
total_cents (integer) — check >= 0
payment_method (payment_method) — enum: cash, card, wallet; default 'cash'
special_instructions (text) — nullable
placed_at (timestamptz) — default timezone('utc', now())
confirmed_at (timestamptz) — nullable
out_for_delivery_at (timestamptz) — nullable
delivered_at (timestamptz) — nullable
cancelled_at (timestamptz) — nullable
confirmation_time_seconds (integer) — nullable; check >= 0; duration from placed to confirmed
preparation_time_seconds (integer) — nullable; check >= 0; duration from confirmed to out_for_delivery
delivery_time_seconds (integer) — nullable; check >= 0; duration from out_for_delivery to delivered
cancellation_reason (text) — nullable
cancelled_by (uuid) — nullable; FK → auth.users.id
delivery_address (jsonb) — JSONB snapshot of consumer address at order time
customer_name (text) — nullable
customer_email (text) — nullable
customer_phone (text) — nullable
created_at (timestamptz) — default timezone('utc', now())
updated_at (timestamptz) — default timezone('utc', now())
Comment: Real-time order tracking with automatic timing calculations and address snapshots
order_items
id (uuid) — PK, default extensions.uuid_generate_v4()
order_id (uuid) — FK → public.orders.id
merchant_item_id (uuid) — FK → public.merchant_items.id
item_name (text) — snapshot at order time
item_description (text) — nullable; snapshot at order time
item_image_url (text) — nullable; snapshot at order time
item_price_cents (integer) — check >= 0; snapshot at order time
quantity (integer) — check > 0
subtotal_cents (integer) — check >= 0; must equal item_price_cents * quantity
created_at (timestamptz) — default timezone('utc', now())
Comment: Order line items with price snapshots preserved at order time



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