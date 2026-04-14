# Migration Mapping — Supabase to .NET / Local PostgreSQL

> **Purpose:** Provides a precise, concept-by-concept translation of every Supabase feature
> used in the current stack to its .NET equivalent. This is the reference document for
> making implementation decisions during the migration.

---

## 1. Authentication

### Current (Supabase)
- `supabase.auth.signUp()` — Creates a record in `auth.users` (Supabase-managed schema)
- `supabase.auth.signInWithPassword()` — Returns a session with JWT
- `supabase.auth.signInWithIdToken({ provider: 'google', token })` — Google OAuth
- `supabase.auth.getUser()` — Validates the active session JWT
- `supabase.auth.signOut()` — Invalidates session on Supabase
- `supabaseAdmin.auth.admin.updateUserById(id, { email_confirm: true })` — Admin email confirmation bypass
- `supabase.rpc('create_user_profile_if_not_exists', ...)` — Fallback profile creation (SECURITY DEFINER function)
- `supabase.rpc('delete_user_account')` — Cascading account deletion (SECURITY DEFINER function)

### New (.NET)
| Supabase Operation | .NET Equivalent |
|---|---|
| `auth.users` table | `AspNetUsers` table (ASP.NET Core Identity) |
| `signUp()` | `UserManager<AppUser>.CreateAsync(user, password)` |
| `signInWithPassword()` | `SignInManager.CheckPasswordSignInAsync()` → generate JWT |
| `signInWithIdToken(google)` | Validate Google ID token via Google OAuth endpoint → find-or-create user → generate JWT |
| `getUser()` | JWT Bearer middleware validates token on every request; user identity extracted from `HttpContext.User` |
| `signOut()` | Stateless JWT — client discards token. For hard revocation: maintain a token blocklist table. |
| Email auto-confirm bypass | `EmailConfirmed = true` set during `UserManager.CreateAsync()` (mobile flow skips email confirmation) |
| `create_user_profile_if_not_exists` RPC | Explicit `IUserProfileRepository.CreateIfNotExistsAsync()` called in `AuthService.RegisterAsync()` — no trigger needed |
| `delete_user_account` RPC | `IUserService.DeleteAccountAsync()` — executes cascade deletes via EF Core in a transaction |
| Role claim | Stored in `user_profiles.role`; included as `role` claim in JWT. Authorization via `[Authorize(Roles = "merchant")]` |

**Key difference:** Supabase Auth uses a separate `auth` schema with trigger-driven side effects. In .NET, every side effect (profile creation, notification cleanup) is explicit service logic in `AuthService`.

---

## 2. Database Access

### Current (Supabase)
- Supabase JS client (`@supabase/supabase-js`) is used for all queries
- PostgREST auto-generates a REST API over PostgreSQL tables
- Row Level Security (RLS) policies on tables enforce access control at the DB layer
- `supabase.from('table').select().eq().single()` — standard query pattern
- `executeWithRetry()` — custom retry wrapper around the Supabase client

### New (.NET)
| Supabase Pattern | .NET Equivalent |
|---|---|
| PostgREST auto-API | ASP.NET Core controllers (explicit, code-defined endpoints) |
| RLS policies | Application-layer authorization checks in service methods + `[Authorize]` attributes on controllers |
| `.from('table').select('*').eq('id', id)` | `_context.TableName.FirstOrDefaultAsync(x => x.Id == id)` |
| `.from('table').insert(data).select().single()` | `_context.TableName.Add(entity); await _context.SaveChangesAsync()` |
| `.from('table').update(data).eq('id', id)` | Fetch entity → mutate properties → `SaveChangesAsync()` |
| `.from('table').delete().eq('id', id)` | Fetch entity → `_context.Remove(entity)` → `SaveChangesAsync()` |
| `.in('column', array)` | EF `.Where(x => ids.Contains(x.Id))` |
| `.select('*, relation(*)')` — join | EF `.Include(x => x.Relation)` |
| `executeWithRetry()` | Polly retry policy configured in `IHttpClientFactory` or DB context resilience (`EnableRetryOnFailure`) |
| `maybeSingle()` | `FirstOrDefaultAsync()` (returns null, not exception) |

**Authorization model:** Supabase RLS is removed. Authorization is enforced at the service layer:
- Users can only read/modify their own data (service checks `claim.UserId == resource.UserId`)
- Merchants can only modify their own shops/inventory (service checks `shop.MerchantId == user.MerchantAccountId`)
- Admin operations require `[Authorize(Roles = "admin")]`

---

## 3. Row Level Security → Service-Layer Authorization

### Current (Supabase)
RLS policies on tables (e.g., `orders`, `shops`, `merchant_items`) define who can `SELECT`, `INSERT`, `UPDATE`, `DELETE` at the PostgreSQL level using `auth.uid()`.

### New (.NET)
| RLS Policy | Service-Layer Equivalent |
|---|---|
| `orders: SELECT WHERE user_id = auth.uid()` | `OrderService.GetUserOrdersAsync(Guid userId)` — `userId` extracted from JWT claim |
| `orders: UPDATE WHERE user_id = auth.uid() AND status = 'pending'` | Service validates ownership AND status before calling `SaveChangesAsync()` |
| `shops: SELECT WHERE is_verified = true` | Service filters by `MerchantAccount.Status == "verified"` |
| `merchant_items: ALL WHERE shop.merchant_id = auth.uid()` | Service fetches merchant account → verifies shop ownership → proceeds |
| SECURITY DEFINER functions (RPC) | Regular service methods; elevated access is not needed when the entire backend is trusted |

---

## 4. Real-Time Subscriptions

### Current (Supabase)
```typescript
supabase.channel('shop-orders')
  .on('postgres_changes', { event: '*', table: 'orders', filter: '...' }, callback)
  .subscribe()
```

### New (.NET)
| Supabase Realtime Feature | SignalR Equivalent |
|---|---|
| Channel subscription | Client calls `hubConnection.invoke("JoinGroup", groupName)` |
| `postgres_changes` event | After `SaveChangesAsync()`, service calls `_hubContext.Clients.Group(groupName).SendAsync("OrderUpdated", dto)` |
| Unsubscribe | Client calls `hubConnection.invoke("LeaveGroup", groupName)` |
| `shop-orders:{shopId}` channel | SignalR group `shop-orders:{shopId}` |
| `order:{orderId}` channel | SignalR group `order:{orderId}` |

**Push pattern:** The service writes to the DB first, then pushes the SignalR event. The client receives the new state directly in the push payload (no need to re-fetch).

---

## 5. Database Triggers → Explicit Service Logic

### Current (Supabase)
Database triggers handled several side effects automatically:

| Trigger | Effect |
|---|---|
| `handle_new_user()` — `AFTER INSERT ON auth.users` | Creates `user_profiles` row |
| `validate_order_status_transition()` — `BEFORE UPDATE ON orders` | Validates allowed status transitions; sets timestamp fields (`confirmed_at`, `out_for_delivery_at`, etc.) |
| `auto_create_delivery_logic_for_shops` — `AFTER INSERT ON shops` | Creates default `shop_delivery_logic` row |
| `log_inventory_change()` — `AFTER UPDATE ON merchant_items` | Inserts into `audit_logs` |

### New (.NET)
All trigger logic is moved into the Application layer as **explicit service calls**:

| Old Trigger | New Service Method |
|---|---|
| `handle_new_user()` | `AuthService.RegisterAsync()` calls `_userProfileRepo.CreateAsync()` after identity user creation — inside the same transaction |
| `validate_order_status_transition()` | `OrderService.TransitionStatusAsync()` contains a state machine validation method. Timestamps set via `entity.ConfirmedAt = DateTimeOffset.UtcNow` |
| `auto_create_delivery_logic` | `ShopService.CreateAsync()` calls `_deliveryLogicRepo.CreateDefaultAsync(shopId)` after shop insert |
| `log_inventory_change()` | `InventoryService.UpdateItemAsync()` calls `_auditLogRepo.LogAsync()` after successful update |

**Rationale:** Explicit code is easier to debug, test, and reason about than database triggers. The business logic lives entirely in the Application layer, which is testable without a database.

---

## 6. Database Schema Concepts

### `auth.users` → `AspNetUsers`
Supabase maintains an `auth.users` table in a separate schema. All foreign keys in the application tables reference `auth.users(id)`.

In .NET, ASP.NET Core Identity creates its own `AspNetUsers` table in the `public` schema. All foreign keys that previously pointed to `auth.users(id)` now point to `AspNetUsers.Id`.

```sql
-- Old
FOREIGN KEY (user_id) REFERENCES auth.users(id)

-- New
FOREIGN KEY (user_id) REFERENCES "AspNetUsers"("Id")
```

The `AppUser` entity extends `IdentityUser<Guid>` to include custom fields and relationships.

### `uuid_generate_v4()` → `Guid.NewGuid()` / `gen_random_uuid()`
EF Core generates GUIDs in C# by default (`ValueGeneratedOnAdd`). The PostgreSQL extension `pgcrypto` (`gen_random_uuid()`) can be used as the DB-side default if needed.

### Timestamp conventions
Supabase uses `timezone('utc', now())` for default timestamps. In EF Core, all `DateTime` properties use `DateTimeOffset` with UTC enforcement:
```csharp
entity.Property(e => e.CreatedAt)
      .HasDefaultValueSql("now() AT TIME ZONE 'utc'");
```

### `USER-DEFINED` types (enums, geometry)
- `order_status` and `payment_method` PostgreSQL enums → C# `enum` types; stored as `text` in PostgreSQL with EF Core value converter (avoids migration complexity)
- `geometry` (PostGIS — `shop_delivery_areas.geom`) → `NetTopologySuite` via `Npgsql.EntityFrameworkCore.PostgreSQL.NetTopologySuite`

---

## 7. Storage (File Uploads)

### Current (Supabase)
Supabase Storage bucket `shop-images` used for shop/item images. URL constructed from Supabase CDN.

### New (.NET)
| Supabase Storage Feature | .NET Equivalent |
|---|---|
| Upload to bucket | `IFormFile` in controller → `IFileStorageService.SaveAsync()` → write to `wwwroot/uploads/{entity}/{id}/` |
| Public URL | Relative URL `/uploads/shops/{shopId}/banner.jpg` served as static files via `UseStaticFiles()` |
| Delete file | `IFileStorageService.DeleteAsync(relativePath)` |
| Path construction | `Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", ...)` — no absolute paths |

---

## 8. Edge Functions / RPC → Service Methods

Supabase Edge Functions and `supabase.rpc()` calls were used for server-side logic that bypassed RLS or required elevated privileges.

| Supabase RPC / Edge Function | .NET Service Method |
|---|---|
| `create_user_profile_if_not_exists` | `IUserProfileService.EnsureProfileExistsAsync(userId)` |
| `delete_user_account` | `IUserService.DeleteAccountAsync(userId)` with explicit cascade |
| `generate_order_number` | `IOrderNumberGenerator.GenerateAsync(shopId)` — uses a DB sequence |
| `find_shops_by_location` | `IShopService.FindByLocationAsync(lat, lon, radiusMeters)` — uses PostGIS `ST_DWithin` |
| `compute_shop_opening_status` | `IShopService.ComputeOpenStatusAsync(shopId)` — evaluates `opening_hours` JSONB |

---

## 9. Push Notifications

### Current (Supabase)
Push notifications were triggered via Supabase Edge Functions or webhooks that called FCM's HTTP v1 API.

### New (.NET)
- Firebase Admin SDK (`FirebaseAdmin` NuGet package) initialized in `Infrastructure` layer
- `INotificationService.SendAsync(userId, title, body)` — fetches `device_tokens` → sends FCM message
- `INotificationService.LogAsync(...)` — writes to `notification_audit_log` table
- Background service retries failed notifications from the `notification_audit_log` where `status = 'failed'`

---

## 10. Webhook Events → In-Process Event Dispatch

### Current (Supabase)
`webhook_events` and `webhook_dead_letters` tables existed to track async event processing (e.g., order created → notify merchant).

### New (.NET)
This pattern is replaced by **in-process event dispatch** using `MediatR` notification handlers (or a simple `IEventDispatcher` interface):

1. Order is saved to DB.
2. `OrderService` publishes `OrderPlacedEvent`.
3. `OrderPlacedEventHandler` sends FCM notification to merchant, sends SignalR push to merchant dashboard.
4. All handlers run in the same request lifecycle (no queue needed for v1).

If async reliability becomes a requirement in later phases, an outbox pattern (similar to `webhook_events`) can be re-introduced using EF Core and a background `IHostedService`.

---

## 11. Excluded Features (This Cycle)

The following Supabase tables and services are **not migrated** in this development cycle:

| Table / Service | Reason |
|---|---|
| `merchant_item_embeddings` | AI feature — excluded |
| `user_preference_embeddings` | AI feature — excluded |
| `user_preferences` | Tied to AI preference learning — excluded |
| `spatial_ref_sys` | PostGIS system table — auto-created by extension |
| Edge Functions calling OpenAI | AI feature — excluded |
| `webhook_events` / `webhook_dead_letters` | Replaced by in-process event dispatch (see §10) |

---

## 12. Migration Execution Plan

### Phase 0 — Infrastructure (Pre-coding)
1. Install PostgreSQL 16 locally
2. Enable extensions: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS postgis;`
3. Create database and application user with least-privilege access
4. Scaffold the solution structure (`dotnet new sln`, four projects)
5. Configure EF Core with Npgsql provider and run `dotnet ef migrations add InitialCreate`

### Phase 1 — Auth (Week 1)
1. Create `AspNetUsers` and Identity tables via EF migration
2. Create `user_profiles` table (FK → `AspNetUsers.Id`)
3. Implement `AuthService` (register, login, Google OAuth, delete account)
4. Implement JWT generation and validation
5. Test: register → login → access protected endpoint → delete account

### Phase 2 — Merchant (Week 2–3)
1. Migrate tables: `merchant_accounts`, `shops`, `merchant_categories`, `category_templates`, `item_templates`, `merchant_items`, `shop_delivery_logic`, `shop_delivery_areas`, `delivery_runners`, `audit_logs`
2. Implement all merchant services
3. Wire SignalR for order updates
4. Test all merchant CRUD operations and order management flow

### Phase 3 — Consumer (Week 4–5)
1. Migrate tables: `consumer_addresses`, `orders`, `order_items`, `reviews`, `device_tokens`, `notification_preferences`, `notification_audit_log`
2. Implement consumer services (shop discovery, order placement, tracking)
3. Implement FCM notification service
4. Test full order lifecycle (place → confirm → dispatch → deliver)
