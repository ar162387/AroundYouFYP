# Database Schema

This document lists all tables in the public schema with their columns, types, constraints, and relationships.

---

## user_profiles

**Description**: User profile information linked to Supabase Auth users.

### Columns

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | uuid | Primary Key | - |
| `email` | text | nullable | - |
| `name` | text | nullable | - |
| `role` | text | check: `role ∈ ('consumer','merchant','admin')` | `'consumer'` |
| `created_at` | timestamp with time zone | - | `now()` |
| `updated_at` | timestamp with time zone | - | `now()` |

### Foreign Keys

- `id` → `auth.users.id`

---

## consumer_addresses

**Description**: Stores delivery addresses for consumers.

### Columns

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | uuid | Primary Key | `uuid_generate_v4()` |
| `user_id` | uuid | - | - |
| `title` | text | nullable, check: `title ∈ ('home','office')` | - |
| `street_address` | text | - | - |
| `city` | text | - | - |
| `region` | text | nullable | - |
| `latitude` | numeric | - | - |
| `longitude` | numeric | - | - |
| `landmark` | text | nullable | - |
| `formatted_address` | text | nullable | - |
| `created_at` | timestamp with time zone | - | `timezone('utc', now())` |
| `updated_at` | timestamp with time zone | - | `timezone('utc', now())` |

**Comments**:
- `title`: Optional address title: home or office (unique per user)
- `street_address`: Street address without city/region
- `landmark`: Optional landmark or flat/house number for clarification

### Foreign Keys

- `user_id` → `auth.users.id`

---

## merchant_accounts

**Description**: Stores merchant account information including shop type and verification status.

### Columns

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | uuid | Primary Key | `uuid_generate_v4()` |
| `user_id` | uuid | unique | - |
| `shop_type` | text | check: `shop_type ∈ ('grocery','meat','vegetable','mart','other')` | - |
| `number_of_shops` | text | check: `number_of_shops ∈ ('1','2','3+')` | - |
| `status` | text | check: `status ∈ ('none','pending','verified')` | `'none'` |
| `created_at` | timestamp with time zone | - | `timezone('utc', now())` |
| `updated_at` | timestamp with time zone | - | `timezone('utc', now())` |

**Comments**:
- `shop_type`: Type of shop
- `number_of_shops`: Number of shops
- `status`: Verification status

### Foreign Keys

- `user_id` → `auth.users.id`

**Referenced By**:
- `shops.merchant_id` → `merchant_accounts.id`

---

## shops

**Description**: Stores shop information for merchants.

### Columns

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | uuid | Primary Key | `uuid_generate_v4()` |
| `merchant_id` | uuid | - | - |
| `name` | text | - | - |
| `description` | text | - | - |
| `shop_type` | text | check: `shop_type ∈ ('Grocery','Meat','Vegetable','Stationery','Dairy')` | - |
| `address` | text | - | - |
| `latitude` | double precision | - | - |
| `longitude` | double precision | - | - |
| `image_url` | text | nullable | - |
| `tags` | text[] | nullable | `'{}'::text[]` |
| `is_open` | boolean | nullable | `true` |
| `created_at` | timestamp with time zone | - | `timezone('utc', now())` |
| `updated_at` | timestamp with time zone | - | `timezone('utc', now())` |

**Comments**:
- `merchant_id`: Reference to the merchant account that owns this shop
- `shop_type`: Type of shop
- `latitude`: Latitude coordinate for shop location
- `longitude`: Longitude coordinate for shop location
- `tags`: Array of tags for searchability and categorization

### Foreign Keys

- `merchant_id` → `merchant_accounts.id`

**Referenced By**:
- `merchant_categories.shop_id`
- `shop_delivery_areas.shop_id`
- `merchant_items.shop_id`
- `audit_logs.shop_id`

---

## category_templates

**Description**: Global category templates that can be used by all merchants.

### Columns

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | uuid | Primary Key | `uuid_generate_v4()` |
| `name` | text | - | - |
| `description` | text | nullable | - |
| `created_at` | timestamp with time zone | - | `timezone('utc', now())` |
| `updated_at` | timestamp with time zone | - | `timezone('utc', now())` |

### Foreign Keys

**Referenced By**:
- `merchant_categories.template_id` → `category_templates.id`

---

## item_templates

**Description**: Global item templates that merchants can adopt into their inventory.

### Columns

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | uuid | Primary Key | `uuid_generate_v4()` |
| `name` | text | - | - |
| `barcode` | text | nullable | - |
| `description` | text | nullable | - |
| `image_url` | text | nullable | - |
| `default_unit` | text | nullable | - |
| `name_normalized` | text | generated, unique, nullable | `lower(TRIM(BOTH FROM name))` |
| `created_at` | timestamp with time zone | - | `timezone('utc', now())` |
| `updated_at` | timestamp with time zone | - | `timezone('utc', now())` |

### Foreign Keys

**Referenced By**:
- `merchant_items.template_id` → `item_templates.id`

---

## merchant_categories

**Description**: Shop-specific categories. Can be based on templates or custom.

### Columns

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | uuid | Primary Key | `uuid_generate_v4()` |
| `shop_id` | uuid | - | - |
| `template_id` | uuid | nullable | - |
| `name` | text | - | - |
| `description` | text | nullable | - |
| `is_custom` | boolean | - | `true` |
| `is_active` | boolean | - | `true` |
| `created_at` | timestamp with time zone | - | `timezone('utc', now())` |
| `updated_at` | timestamp with time zone | - | `timezone('utc', now())` |

### Foreign Keys

- `template_id` → `category_templates.id`
- `shop_id` → `shops.id`

**Referenced By**:
- `merchant_item_categories.merchant_category_id` → `merchant_categories.id`

---

## merchant_items

**Description**: Shop-specific inventory items. Can be based on templates or custom.

### Columns

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | uuid | Primary Key | `uuid_generate_v4()` |
| `shop_id` | uuid | - | - |
| `template_id` | uuid | nullable | - |
| `name` | text | nullable | - |
| `description` | text | nullable | - |
| `barcode` | text | nullable | - |
| `image_url` | text | nullable | - |
| `sku` | text | nullable | - |
| `price_cents` | integer | check: `price_cents >= 0` | `0` |
| `currency` | text | - | `'PKR'` |
| `is_active` | boolean | - | `true` |
| `is_custom` | boolean | - | `true` |
| `created_by` | uuid | nullable | `auth.uid()` |
| `last_updated_by` | jsonb | nullable | - |
| `created_at` | timestamp with time zone | - | `timezone('utc', now())` |
| `updated_at` | timestamp with time zone | - | `timezone('utc', now())` |

### Foreign Keys

- `template_id` → `item_templates.id`
- `shop_id` → `shops.id`

**Referenced By**:
- `audit_logs.merchant_item_id`
- `merchant_item_categories.merchant_item_id`

---

## merchant_item_categories

**Description**: Junction table linking items to categories (many-to-many relationship).

### Columns

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `merchant_item_id` | uuid | Primary Key (composite) | - |
| `merchant_category_id` | uuid | Primary Key (composite) | - |
| `sort_order` | integer | - | `0` |

### Foreign Keys

- `merchant_category_id` → `merchant_categories.id`
- `merchant_item_id` → `merchant_items.id`

---

## audit_logs

**Description**: Audit trail for inventory changes.

### Columns

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | uuid | Primary Key | `uuid_generate_v4()` |
| `shop_id` | uuid | - | - |
| `merchant_item_id` | uuid | nullable | - |
| `actor` | jsonb | - | - |
| `action_type` | text | - | - |
| `changed_fields` | jsonb | - | `'{}'::jsonb` |
| `source` | text | - | `'manual'` |
| `created_at` | timestamp with time zone | - | `timezone('utc', now())` |

### Foreign Keys

- `shop_id` → `shops.id`
- `merchant_item_id` → `merchant_items.id`

---

## shop_delivery_areas

**Description**: Stores delivery area polygons for shops using PostGIS geometry.

### Columns

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | uuid | Primary Key | `uuid_generate_v4()` |
| `shop_id` | uuid | - | - |
| `label` | text | nullable | - |
| `geom` | geometry | user-defined | - |
| `created_at` | timestamp with time zone | - | `timezone('utc', now())` |
| `updated_at` | timestamp with time zone | - | `timezone('utc', now())` |

### Foreign Keys

- `shop_id` → `shops.id`

---

## spatial_ref_sys

**Description**: Standard spatial reference system table (PostGIS).

**Note**: This is a standard PostGIS table with approximately 8,500 rows.

### Columns

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `srid` | integer | Primary Key, check: `srid > 0 AND srid <= 998999` | - |
| `auth_name` | character varying | nullable | - |
| `auth_srid` | integer | nullable | - |
| `srtext` | character varying | nullable | - |
| `proj4text` | character varying | nullable | - |

---

*Schema generated from Supabase database*
