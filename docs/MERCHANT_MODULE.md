# Module: Merchant-Side Logic

> **Phase:** 2  
> **Prerequisite:** Phase 1 (Auth) must be complete and deployed.  
> **Standard:** Per `backend/SOP's.md`  
> **Source Mapping:** `src/services/merchant/` (merchantService, shopService, inventoryService, deliveryLogicService, deliveryAreaService, deliveryRunnerService, orderService)

---

## 1. Overview

The Merchant module manages everything a shop owner needs:

1. **Merchant Account** — Apply as a merchant, track verification status
2. **Shop Management** — Create, read, update, delete shops; manage opening hours
3. **Inventory Management** — Categories and items (with category templates and item templates)
4. **Delivery Configuration** — Delivery logic (tiered fee rules), delivery area polygons, delivery runners
5. **Order Management** — View, filter, and transition order statuses; assign runners; view analytics

All endpoints in this module require `[Authorize(Roles = "merchant")]`.

---

## 2. Entities (Domain Layer)

| Entity | Table | Key Relationships |
|---|---|---|
| `MerchantAccount` | `merchant_accounts` | 1:1 with AppUser; 1:N with Shop |
| `Shop` | `shops` | N:1 MerchantAccount; 1:1 DeliveryLogic; 1:N Categories, Items, Runners |
| `MerchantCategory` | `merchant_categories` | N:1 Shop; N:1 CategoryTemplate (optional) |
| `CategoryTemplate` | `category_templates` | 1:N MerchantCategory |
| `MerchantItem` | `merchant_items` | N:1 Shop; N:1 ItemTemplate (optional); N:M MerchantCategory |
| `ItemTemplate` | `item_templates` | 1:N MerchantItem |
| `MerchantItemCategory` | `merchant_item_categories` | Junction: MerchantItem ↔ MerchantCategory |
| `ShopDeliveryLogic` | `shop_delivery_logic` | 1:1 Shop (auto-created) |
| `ShopDeliveryArea` | `shop_delivery_areas` | N:1 Shop |
| `DeliveryRunner` | `delivery_runners` | N:1 Shop |
| `AuditLog` | `audit_logs` | N:1 Shop; N:1 MerchantItem (optional) |

### Key Value Objects / Nested Types (Domain Layer)

```csharp
// Stored as JSONB in shop_delivery_logic.distance_tiers
public record DistanceTier(decimal MaxDistanceMeters, decimal FeeInPkr);

// Stored as JSONB in shops.opening_hours
public record DailyHours(TimeOnly Open, TimeOnly Close, bool IsOpen);
public record OpeningHoursSchedule  // keyed by DayOfWeek
{
    public DailyHours Monday { get; init; }
    // ... all 7 days
}

// C# enums
public enum ShopType        { Grocery, Meat, Vegetable, Stationery, Dairy, Pharmacy }
public enum OpenStatusMode  { Auto, ManualOpen, ManualClosed }
public enum DistanceMode    { Auto, Custom }
public enum MerchantStatus  { None, Pending, Verified }
```

---

## 3. DTOs (Application Layer)

### Merchant Account DTOs

```csharp
// POST /api/v1/merchant/account
CreateMerchantAccountRequest
  ShopType          string   Required — 'grocery'|'meat'|'vegetable'|'mart'|'other'
  NumberOfShops     string   Required — '1'|'2'|'3+'
  NameAsPerCnic     string?
  Cnic              string?
  CnicExpiry        DateOnly?

MerchantAccountDto
  Id                Guid
  UserId            Guid
  ShopType          string
  NumberOfShops     string
  Status            string  // 'none' | 'pending' | 'verified'
  NameAsPerCnic     string?
  Cnic              string?
  CnicExpiry        DateOnly?
  CreatedAt         DateTimeOffset
```

### Shop DTOs

```csharp
// POST /api/v1/merchant/shops
CreateShopRequest
  Name              string   Required
  Description       string   Required
  ShopType          string   Required
  Address           string   Required
  Latitude          double   Required
  Longitude         double   Required
  Tags              string[] Optional
  OpeningHours      object?  Optional — weekly schedule
  OpenStatusMode    string   Optional — default 'auto'

// PUT /api/v1/merchant/shops/{shopId}
UpdateShopRequest
  Name              string?
  Description       string?
  Address           string?
  Latitude          double?
  Longitude         double?
  Tags              string[]?
  OpeningHours      object?
  OpenStatusMode    string?
  IsOpen            bool?    (manual override for is_open flag)

ShopDto
  Id                Guid
  MerchantId        Guid
  Name              string
  Description       string
  ShopType          string
  Address           string
  Latitude          double
  Longitude         double
  ImageUrl          string?
  Tags              string[]
  IsOpen            bool
  ComputedIsOpen    bool    // computed from opening_hours + current time
  OpenStatusMode    string
  OpeningHours      object?
  CreatedAt         DateTimeOffset
  UpdatedAt         DateTimeOffset
```

### Inventory DTOs

```csharp
// POST /api/v1/merchant/shops/{shopId}/categories
CreateCategoryRequest
  Name              string   Required
  Description       string?
  TemplateId        Guid?

// POST /api/v1/merchant/shops/{shopId}/items
CreateItemRequest
  Name              string   Required
  Description       string?
  PriceCents        int      Required (≥ 0)
  TemplateId        Guid?
  CategoryIds       Guid[]   Optional
  Barcode           string?
  Sku               string?
  IsActive          bool     Default true

// PUT /api/v1/merchant/shops/{shopId}/items/{itemId}
UpdateItemRequest
  Name              string?
  Description       string?
  PriceCents        int?
  CategoryIds       Guid[]?
  Barcode           string?
  Sku               string?
  IsActive          bool?

MerchantItemDto
  Id                Guid
  ShopId            Guid
  Name              string
  Description       string?
  PriceCents        int
  Currency          string
  ImageUrl          string?
  Barcode           string?
  Sku               string?
  IsActive          bool
  IsCustom          bool
  TimesSold         int
  TotalRevenueCents long
  Categories        CategorySummaryDto[]
  TemplateId        Guid?
  CreatedAt         DateTimeOffset
  UpdatedAt         DateTimeOffset
```

### Delivery Logic DTOs

```csharp
// PUT /api/v1/merchant/shops/{shopId}/delivery-logic
UpdateDeliveryLogicRequest
  MinimumOrderValue        decimal  Required
  SmallOrderSurcharge      decimal  Required
  LeastOrderValue          decimal  Required
  DistanceMode             string?  'auto' | 'custom'
  MaxDeliveryFee           decimal?
  DistanceTiers            DistanceTierDto[]?
  BeyondTierFeePerUnit     decimal?
  BeyondTierDistanceUnit   decimal?
  FreeDeliveryThreshold    decimal?
  FreeDeliveryRadius       decimal?

DistanceTierDto
  MaxDistance    decimal    (meters)
  Fee            decimal    (PKR)

DeliveryLogicDto  (same fields as request, plus Id, ShopId, timestamps)
```

### Order DTOs (Merchant View)

```csharp
MerchantOrderDto
  Id                       Guid
  OrderNumber              string
  Status                   string
  SubtotalCents            int
  DeliveryFeeCents         int
  SurchargeCents           int
  TotalCents               int
  PaymentMethod            string
  SpecialInstructions      string?
  PlacedAt                 DateTimeOffset
  ConfirmedAt              DateTimeOffset?
  OutForDeliveryAt         DateTimeOffset?
  DeliveredAt              DateTimeOffset?
  CancelledAt              DateTimeOffset?
  CancellationReason       string?
  CustomerName             string?
  CustomerEmail            string?
  DeliveryAddress          DeliveryAddressDto
  Items                    OrderItemDto[]
  DeliveryRunner           RunnerSummaryDto?

// POST /api/v1/merchant/shops/{shopId}/orders/{orderId}/confirm
// POST /api/v1/merchant/shops/{shopId}/orders/{orderId}/dispatch
DispatchOrderRequest
  RunnerId    Guid    Required

// POST /api/v1/merchant/shops/{shopId}/orders/{orderId}/deliver
// POST /api/v1/merchant/shops/{shopId}/orders/{orderId}/cancel
CancelOrderRequest
  Reason    string    Required
```

### Analytics DTOs

```csharp
OrderAnalyticsDto
  TotalOrders                    int
  TotalRevenueCents              long
  AverageOrderValueCents         long
  AverageConfirmationTimeSeconds int?
  AveragePreparationTimeSeconds  int?
  AverageDeliveryTimeSeconds     int?
  StatusBreakdown                Dictionary<string, int>

OrderTimeSeriesDto
  XLabels    string[]    (hour labels, day labels, week labels, or month labels)
  Data       decimal[]   (revenue in PKR per time bucket)
  Orders     int
  Revenue    long        (cents)
```

---

## 4. Service Interfaces (Application Layer)

```csharp
public interface IMerchantAccountService
{
    Task<Result<MerchantAccountDto>> GetByUserIdAsync(Guid userId);
    Task<Result<MerchantAccountDto>> CreateAsync(Guid userId, CreateMerchantAccountRequest request);
    Task<Result<MerchantAccountDto>> UpdateAsync(Guid userId, UpdateMerchantAccountRequest request);
    Task<Result> DeleteAsync(Guid userId);
}

public interface IShopService
{
    Task<Result<List<ShopDto>>> GetByMerchantAsync(Guid userId);
    Task<Result<ShopDto>> GetByIdAsync(Guid shopId, Guid merchantUserId);
    Task<Result<ShopDto>> CreateAsync(Guid userId, CreateShopRequest request);
    Task<Result<ShopDto>> UpdateAsync(Guid shopId, Guid userId, UpdateShopRequest request);
    Task<Result> DeleteAsync(Guid shopId, Guid userId);
    Task<Result> UploadImageAsync(Guid shopId, Guid userId, IFormFile image);
    Task<bool> ComputeOpenStatusAsync(Guid shopId);
}

public interface IInventoryService
{
    // Categories
    Task<Result<List<CategoryDto>>> GetCategoriesAsync(Guid shopId, Guid userId);
    Task<Result<CategoryDto>> CreateCategoryAsync(Guid shopId, Guid userId, CreateCategoryRequest request);
    Task<Result<CategoryDto>> UpdateCategoryAsync(Guid categoryId, Guid userId, UpdateCategoryRequest request);
    Task<Result> DeleteCategoryAsync(Guid categoryId, Guid userId);

    // Items
    Task<Result<List<MerchantItemDto>>> GetItemsAsync(Guid shopId, Guid userId);
    Task<Result<MerchantItemDto>> GetItemByIdAsync(Guid itemId, Guid userId);
    Task<Result<MerchantItemDto>> CreateItemAsync(Guid shopId, Guid userId, CreateItemRequest request);
    Task<Result<MerchantItemDto>> UpdateItemAsync(Guid itemId, Guid userId, UpdateItemRequest request);
    Task<Result> DeleteItemAsync(Guid itemId, Guid userId);
    Task<Result> UploadItemImageAsync(Guid itemId, Guid userId, IFormFile image);

    // Templates
    Task<Result<List<CategoryTemplateDto>>> GetCategoryTemplatesAsync();
    Task<Result<List<ItemTemplateDto>>> GetItemTemplatesAsync(string? search);
}

public interface IDeliveryLogicService
{
    Task<Result<DeliveryLogicDto>> GetByShopIdAsync(Guid shopId, Guid userId);
    Task<Result<DeliveryLogicDto>> UpsertAsync(Guid shopId, Guid userId, UpdateDeliveryLogicRequest request);
}

public interface IDeliveryRunnerService
{
    Task<Result<List<DeliveryRunnerWithStatusDto>>> GetByShopIdAsync(Guid shopId, Guid userId);
    Task<Result<DeliveryRunnerDto>> CreateAsync(Guid shopId, Guid userId, CreateRunnerRequest request);
    Task<Result<DeliveryRunnerDto>> UpdateAsync(Guid runnerId, Guid userId, UpdateRunnerRequest request);
    Task<Result> DeleteAsync(Guid runnerId, Guid userId);
}

public interface IMerchantOrderService
{
    Task<Result<List<MerchantOrderDto>>> GetShopOrdersAsync(Guid shopId, Guid userId, OrderFilters filters);
    Task<Result<MerchantOrderDto>> GetOrderByIdAsync(Guid orderId, Guid userId);
    Task<Result> ConfirmOrderAsync(Guid orderId, Guid userId);
    Task<Result> DispatchOrderAsync(Guid orderId, Guid userId, Guid runnerId);
    Task<Result> MarkDeliveredAsync(Guid orderId, Guid userId);
    Task<Result> CancelOrderAsync(Guid orderId, Guid userId, string reason);
    Task<Result<OrderAnalyticsDto>> GetAnalyticsAsync(Guid shopId, Guid userId, OrderFilters filters);
    Task<Result<OrderTimeSeriesDto>> GetTimeSeriesAsync(Guid shopId, Guid userId, TimeSeriesFilter filter);
}
```

---

## 5. Core Business Logic

### 5.1 Shop Open Status Computation

```
Given: shop.OpenStatusMode, shop.OpeningHours (JSONB), current UTC time

if OpenStatusMode == 'manual_open'  → return true
if OpenStatusMode == 'manual_closed' → return false
if OpenStatusMode == 'auto':
    dayOfWeek = currentUtcTime.DayOfWeek
    schedule = opening_hours[dayOfWeek]
    if schedule.IsOpen == false → return false
    currentTime = currentUtcTime.TimeOfDay
    if currentTime >= schedule.Open AND currentTime <= schedule.Close → return true
    else → return false
```

### 5.2 Default Delivery Logic on Shop Create

When `ShopService.CreateAsync()` succeeds:
```csharp
await _deliveryLogicRepo.CreateDefaultAsync(new ShopDeliveryLogic
{
    ShopId = newShop.Id,
    MinimumOrderValue = 200,
    SmallOrderSurcharge = 40,
    LeastOrderValue = 100,
    DistanceMode = DistanceMode.Auto,
    MaxDeliveryFee = 130,
    DistanceTiers = DefaultTiers,   // [200m/₨20, 400m/₨30, 600m/₨40, 800m/₨50, 1000m/₨60]
    BeyondTierFeePerUnit = 10,
    BeyondTierDistanceUnit = 250,
    FreeDeliveryThreshold = 800,
    FreeDeliveryRadius = 1000,
});
```

### 5.3 Order Status State Machine

Implemented as a domain service method `OrderStateMachine.IsValidTransition(from, to)`:

```
Allowed transitions:
  Pending         → Confirmed          (merchant confirms)
  Pending         → Cancelled          (merchant OR consumer before confirmation)
  Confirmed       → OutForDelivery     (merchant dispatches with runner)
  OutForDelivery  → Delivered          (merchant marks delivered)

Forbidden (rejected with Result.Failure):
  Any terminal status → any other status
  Skipping states (e.g., Pending → Delivered)
  Confirmed → Cancelled (not supported in v1)
```

### 5.4 Order Status Transition Side Effects

All side effects are explicit in `MerchantOrderService.TransitionStatusAsync()`:

| Transition | Side Effects |
|---|---|
| `→ Confirmed` | `ConfirmedAt = UtcNow`; `ConfirmationTimeSeconds = (ConfirmedAt - PlacedAt).TotalSeconds` |
| `→ OutForDelivery` | `OutForDeliveryAt = UtcNow`; `PreparationTimeSeconds = (OutForDeliveryAt - ConfirmedAt).TotalSeconds`; `DeliveryRunnerId = runnerId` |
| `→ Delivered` | `DeliveredAt = UtcNow`; `DeliveryTimeSeconds = (DeliveredAt - OutForDeliveryAt).TotalSeconds`; Update `merchant_items.times_sold` and `total_revenue_cents` for each order item |
| `→ Cancelled` | `CancelledAt = UtcNow`; `CancellationReason = reason`; `CancelledBy = merchantUserId` |

After every transition:
1. `SaveChangesAsync()` (persist to DB)
2. `_hubContext.Clients.Group($"order:{orderId}").SendAsync("OrderStatusChanged", orderDto)` (consumer SignalR)
3. `_hubContext.Clients.Group($"shop-orders:{shopId}").SendAsync("OrderUpdated", orderDto)` (merchant dashboard)
4. `_notificationService.SendAsync(...)` (FCM push to consumer and/or merchant)

### 5.5 Inventory Audit Logging

Every call to `InventoryService.UpdateItemAsync()` that changes price, name, or active status must call:
```csharp
await _auditLogRepo.LogAsync(new AuditLog
{
    ShopId = item.ShopId,
    MerchantItemId = item.Id,
    Actor = new ActorSnapshot { Id = userId, Name = userName, Role = "merchant" },
    ActionType = "price_updated",   // or 'name_updated', 'item_deactivated', etc.
    ChangedFields = changedFieldsJson,
    Source = "manual",
});
```

### 5.6 Merchant Ownership Verification

Every service method that operates on a shop-scoped resource must verify ownership:

```csharp
private async Task<Result<Shop>> VerifyShopOwnershipAsync(Guid shopId, Guid userId)
{
    var merchantAccount = await _merchantAccountRepo.GetByUserIdAsync(userId);
    if (merchantAccount is null)
        return Result.Failure<Shop>("Merchant account not found");

    var shop = await _shopRepo.GetByIdAsync(shopId);
    if (shop is null)
        return Result.Failure<Shop>("Shop not found");

    if (shop.MerchantId != merchantAccount.Id)
        return Result.Failure<Shop>("Access denied");

    return Result.Success(shop);
}
```

---

## 6. Controller Routes

**Route prefix:** `/api/v1/merchant`  
**Authorization:** All require `[Authorize(Roles = "merchant")]`

### Merchant Account
| Method | Route | Description |
|---|---|---|
| `GET` | `/account` | Get own merchant account |
| `POST` | `/account` | Apply as merchant |
| `PUT` | `/account` | Update merchant account details |
| `DELETE` | `/account` | Delete merchant account |

### Shops
| Method | Route | Description |
|---|---|---|
| `GET` | `/shops` | List all shops owned by merchant |
| `GET` | `/shops/{shopId}` | Get shop detail |
| `POST` | `/shops` | Create new shop |
| `PUT` | `/shops/{shopId}` | Update shop |
| `DELETE` | `/shops/{shopId}` | Delete shop (cascades inventory) |
| `POST` | `/shops/{shopId}/image` | Upload shop banner image (`multipart/form-data`) |

### Inventory — Categories
| Method | Route | Description |
|---|---|---|
| `GET` | `/shops/{shopId}/categories` | List shop categories |
| `POST` | `/shops/{shopId}/categories` | Create category |
| `PUT` | `/shops/{shopId}/categories/{catId}` | Update category |
| `DELETE` | `/shops/{shopId}/categories/{catId}` | Delete category |
| `GET` | `/templates/categories` | List system category templates |

### Inventory — Items
| Method | Route | Description |
|---|---|---|
| `GET` | `/shops/{shopId}/items` | List shop items (with categories) |
| `GET` | `/shops/{shopId}/items/{itemId}` | Get single item |
| `POST` | `/shops/{shopId}/items` | Create item |
| `PUT` | `/shops/{shopId}/items/{itemId}` | Update item |
| `DELETE` | `/shops/{shopId}/items/{itemId}` | Delete item |
| `POST` | `/shops/{shopId}/items/{itemId}/image` | Upload item image |
| `GET` | `/templates/items` | Search item templates |

### Delivery Configuration
| Method | Route | Description |
|---|---|---|
| `GET` | `/shops/{shopId}/delivery-logic` | Get delivery logic |
| `PUT` | `/shops/{shopId}/delivery-logic` | Update delivery logic |
| `GET` | `/shops/{shopId}/delivery-areas` | List delivery areas (polygons) |
| `POST` | `/shops/{shopId}/delivery-areas` | Create delivery area |
| `DELETE` | `/shops/{shopId}/delivery-areas/{areaId}` | Delete delivery area |
| `GET` | `/shops/{shopId}/runners` | List runners with availability status |
| `POST` | `/shops/{shopId}/runners` | Add delivery runner |
| `PUT` | `/shops/{shopId}/runners/{runnerId}` | Update runner |
| `DELETE` | `/shops/{shopId}/runners/{runnerId}` | Remove runner |

### Orders
| Method | Route | Description |
|---|---|---|
| `GET` | `/shops/{shopId}/orders` | List orders (with filter params) |
| `GET` | `/shops/{shopId}/orders/{orderId}` | Get single order |
| `POST` | `/shops/{shopId}/orders/{orderId}/confirm` | Confirm order |
| `POST` | `/shops/{shopId}/orders/{orderId}/dispatch` | Assign runner + mark out_for_delivery |
| `POST` | `/shops/{shopId}/orders/{orderId}/deliver` | Mark delivered |
| `POST` | `/shops/{shopId}/orders/{orderId}/cancel` | Cancel order |
| `GET` | `/shops/{shopId}/analytics` | Order analytics (query params: time filter) |
| `GET` | `/shops/{shopId}/analytics/time-series` | Revenue time-series data |

---

## 7. SignalR — Merchant Dashboard

Merchants connect to the SignalR hub on the dashboard screen. The mobile app:
1. Calls `hubConnection.invoke("JoinShopGroup", shopId)` after connection
2. Listens for `"OrderUpdated"` events → refreshes order list
3. Calls `hubConnection.invoke("LeaveShopGroup", shopId)` on disconnect

Server Hub method:
```csharp
public class OrderHub : Hub
{
    public async Task JoinShopGroup(string shopId)
        => await Groups.AddToGroupAsync(Context.ConnectionId, $"shop-orders:{shopId}");

    public async Task LeaveShopGroup(string shopId)
        => await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"shop-orders:{shopId}");

    public async Task JoinOrderGroup(string orderId)
        => await Groups.AddToGroupAsync(Context.ConnectionId, $"order:{orderId}");
}
```

---

## 8. Migration Plan — Merchant Module

### Step 1: Database Migration
- Add EF entities and Fluent API config for all merchant tables
- Run `dotnet ef migrations add AddMerchantTables`
- Seed `category_templates` and `item_templates` from existing data

### Step 2: Merchant Account
- Implement `MerchantAccountService` and controller
- Test: consumer JWT cannot access merchant routes; merchant role access works

### Step 3: Shop CRUD
- Implement `ShopService` with `CreateAsync` that auto-creates default delivery logic
- Implement file upload for shop images
- Test: create shop → delivery logic auto-created; upload image → URL served as static file

### Step 4: Inventory
- Implement `InventoryService` for categories and items
- Test: create item → audit log written; update price → changed_fields recorded

### Step 5: Delivery Configuration
- Implement `DeliveryLogicService` and `DeliveryRunnerService`
- Test: delivery fee calculation matches TypeScript logic exactly (use same test cases)

### Step 6: Order Management + SignalR
- Implement `MerchantOrderService` with state machine
- Configure SignalR hub and CORS
- Test: confirm order → consumer SignalR group receives event; analytics query returns correct metrics
