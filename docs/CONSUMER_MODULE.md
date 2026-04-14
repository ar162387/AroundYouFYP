# Module: Consumer-Side Logic

> **Phase:** 3  
> **Prerequisite:** Phase 1 (Auth) + Phase 2 (Merchant) must be complete.  
> **Standard:** Per `backend/SOP's.md`  
> **Source Mapping:** `src/services/consumer/` (addressService, orderService, shopService, deliveryFeeService, reviewService, stockValidationService, userProfileService) and `src/services/notificationService.ts`, `src/services/notificationPreferencesService.ts`

---

## 1. Overview

The Consumer module powers everything the end customer interacts with:

1. **Consumer Profile** — View and update personal details
2. **Address Management** — Save, update, and delete delivery addresses
3. **Shop Discovery** — Find nearby verified shops by location and type; compute live open status and delivery fees
4. **Shop Detail** — Browse a shop's active inventory by category
5. **Order Placement** — Place orders with real-time fee calculation and minimum order validation
6. **Order Tracking** — Track live order status with SignalR updates
7. **Reviews** — Leave a rating and review for a delivered order
8. **Notifications** — Manage push notification preferences; receive FCM order updates

Most read-only endpoints (shop list, shop detail, items) are accessible to authenticated consumers. Order and address endpoints require `[Authorize(Roles = "consumer")]`.

---

## 2. Entities (Domain Layer)

The consumer module primarily reads entities defined in other modules (Shops, Orders, etc.) and owns these:

| Entity | Table | Owned By |
|---|---|---|
| `ConsumerAddress` | `consumer_addresses` | Consumer |
| `Order` | `orders` | Shared (consumer places, merchant manages) |
| `OrderItem` | `order_items` | Owned by Order |
| `Review` | `reviews` | Consumer |
| `NotificationPreference` | `notification_preferences` | Shared (consumer + merchant records) |

Shared entities consumed read-only: `Shop`, `MerchantItem`, `MerchantCategory`, `DeliveryRunner`, `ShopDeliveryLogic`.

### Enums
```csharp
public enum AddressTitle   { Home, Office }
public enum OrderStatus    { Pending, Confirmed, OutForDelivery, Delivered, Cancelled }
public enum PaymentMethod  { Cash, Card, Online }
```

---

## 3. DTOs (Application Layer)

### Profile DTOs

```csharp
ConsumerProfileDto
  Id            Guid
  Email         string
  Name          string?
  Role          string     // 'consumer'
  CreatedAt     DateTimeOffset

UpdateConsumerProfileRequest
  Name          string?    Optional — max 100 chars
```

### Address DTOs

```csharp
// POST /api/v1/consumer/addresses
CreateAddressRequest
  Title             string   Optional — 'home' | 'office'
  StreetAddress     string   Required
  City              string   Required
  Region            string?
  Latitude          decimal  Required
  Longitude         decimal  Required
  Landmark          string?
  FormattedAddress  string?

// PUT /api/v1/consumer/addresses/{addressId}
UpdateAddressRequest
  Title             string?
  StreetAddress     string?
  City              string?
  Region            string?
  Latitude          decimal?
  Longitude         decimal?
  Landmark          string?
  FormattedAddress  string?

ConsumerAddressDto
  Id                Guid
  Title             string?
  StreetAddress     string
  City              string
  Region            string?
  Latitude          decimal
  Longitude         decimal
  Landmark          string?
  FormattedAddress  string?
  CreatedAt         DateTimeOffset
```

### Shop Discovery DTOs

```csharp
// GET /api/v1/consumer/shops?lat=...&lon=...&radius=...&type=...
ShopDiscoveryRequest (query params)
  Latitude       double   Required
  Longitude      double   Required
  RadiusMeters   double   Optional — default 5000 (5 km)
  ShopType       string?  Optional — filter by type
  Page           int      Default 1
  PageSize       int      Default 20

ConsumerShopDto
  Id               Guid
  Name             string
  Description      string
  ShopType         string
  Address          string
  Latitude         double
  Longitude        double
  ImageUrl         string?
  Tags             string[]
  IsOpen           bool         // computed open status
  DistanceMeters   double       // distance from consumer location
  DeliveryFee      decimal      // base delivery fee (PKR) — 0 if unknown
  MinimumOrderValue decimal?
  Rating           decimal?     // average review rating
  ReviewCount      int
  CreatedAt        DateTimeOffset
```

### Shop Detail DTOs

```csharp
ShopDetailDto : ConsumerShopDto
  Categories     ConsumerCategoryDto[]

ConsumerCategoryDto
  Id         Guid
  Name       string
  Items      ConsumerItemDto[]

ConsumerItemDto
  Id             Guid
  Name           string
  Description    string?
  PriceCents     int
  Currency       string
  ImageUrl       string?
  IsActive       bool
  TimesSold      int
```

### Order DTOs

```csharp
// POST /api/v1/consumer/orders
PlaceOrderRequest
  ShopId                  Guid               Required
  ConsumerAddressId       Guid               Required
  Items                   OrderItemRequest[] Required (min 1 item)
  PaymentMethod           string             Required — 'cash' | 'card' | 'online'
  SpecialInstructions     string?            Optional

OrderItemRequest
  MerchantItemId   Guid    Required
  Quantity         int     Required (≥ 1)

// POST /api/v1/consumer/orders/calculate
// (Preview fees before confirming — does not create an order)
CalculateOrderRequest
  ShopId              Guid               Required
  ConsumerAddressId   Guid               Required
  Items               OrderItemRequest[]

OrderCalculationDto
  SubtotalCents        int
  DeliveryFeeCents     int
  SurchargeCents       int
  TotalCents           int
  DistanceMeters       double
  FreeDeliveryApplied  bool

ConsumerOrderDto
  Id                    Guid
  OrderNumber           string
  Status                string
  SubtotalCents         int
  DeliveryFeeCents      int
  SurchargeCents        int
  TotalCents            int
  PaymentMethod         string
  SpecialInstructions   string?
  PlacedAt              DateTimeOffset
  ConfirmedAt           DateTimeOffset?
  OutForDeliveryAt      DateTimeOffset?
  DeliveredAt           DateTimeOffset?
  CancelledAt           DateTimeOffset?
  CancellationReason    string?
  DeliveryAddress       DeliveryAddressDto
  Shop                  ShopSummaryDto
  Items                 ConsumerOrderItemDto[]
  DeliveryRunner        RunnerSummaryDto?
  HasReview             bool

// POST /api/v1/consumer/orders/{orderId}/cancel
CancelOrderRequest
  Reason    string?    Optional — default 'Cancelled by customer'
```

### Review DTOs

```csharp
// POST /api/v1/consumer/reviews
CreateReviewRequest
  ShopId       Guid     Required
  OrderId      Guid?    Optional
  Rating       int      Required (1–5)
  ReviewText   string?  Optional — max 500 chars

ReviewDto
  Id           Guid
  UserId       Guid
  ShopId       Guid
  OrderId      Guid?
  Rating       int
  ReviewText   string?
  CreatedAt    DateTimeOffset
```

### Notification DTOs

```csharp
NotificationPreferenceDto
  Id                       Guid
  UserId                   Guid
  Role                     string
  AllowPushNotifications   bool

UpdateNotificationPreferenceRequest
  AllowPushNotifications   bool   Required
```

---

## 4. Service Interfaces (Application Layer)

```csharp
public interface IConsumerProfileService
{
    Task<Result<ConsumerProfileDto>> GetProfileAsync(Guid userId);
    Task<Result<ConsumerProfileDto>> UpdateProfileAsync(Guid userId, UpdateConsumerProfileRequest request);
}

public interface IConsumerAddressService
{
    Task<Result<List<ConsumerAddressDto>>> GetAddressesAsync(Guid userId);
    Task<Result<ConsumerAddressDto>> GetAddressByIdAsync(Guid addressId, Guid userId);
    Task<Result<ConsumerAddressDto>> CreateAddressAsync(Guid userId, CreateAddressRequest request);
    Task<Result<ConsumerAddressDto>> UpdateAddressAsync(Guid addressId, Guid userId, UpdateAddressRequest request);
    Task<Result> DeleteAddressAsync(Guid addressId, Guid userId);
}

public interface IConsumerShopService
{
    Task<Result<List<ConsumerShopDto>>> FindByLocationAsync(
        double latitude, double longitude,
        double radiusMeters = 5000,
        string? shopType = null,
        int page = 1, int pageSize = 20);

    Task<Result<ShopDetailDto>> GetShopDetailAsync(Guid shopId, double? consumerLat, double? consumerLon);
}

public interface IConsumerOrderService
{
    Task<Result<OrderCalculationDto>> CalculateAsync(CalculateOrderRequest request);
    Task<Result<ConsumerOrderDto>> PlaceOrderAsync(Guid userId, PlaceOrderRequest request);
    Task<Result<List<ConsumerOrderDto>>> GetUserOrdersAsync(Guid userId);
    Task<Result<ConsumerOrderDto>> GetOrderByIdAsync(Guid orderId, Guid userId);
    Task<Result<ConsumerOrderDto?>> GetActiveOrderAsync(Guid userId);
    Task<Result> CancelOrderAsync(Guid orderId, Guid userId, string? reason);
}

public interface IDeliveryFeeCalculatorService
{
    Task<decimal> CalculateBaseFeeAsync(Guid shopId, double consumerLat, double consumerLon);
    OrderFeeBreakdown CalculateTotalFee(decimal subtotalPkr, double distanceMeters, ShopDeliveryLogic logic);
}

public interface IReviewService
{
    Task<Result<ReviewDto>> CreateReviewAsync(Guid userId, CreateReviewRequest request);
    Task<Result<List<ReviewDto>>> GetShopReviewsAsync(Guid shopId, int page = 1, int pageSize = 20);
}

public interface INotificationPreferenceService
{
    Task<Result<NotificationPreferenceDto>> GetAsync(Guid userId, string role);
    Task<Result<NotificationPreferenceDto>> UpsertAsync(Guid userId, string role, UpdateNotificationPreferenceRequest request);
}

public interface INotificationService
{
    Task SendOrderNotificationAsync(Guid orderId, Guid recipientUserId, string role,
        string notificationType, string title, string body);
}
```

---

## 5. Core Business Logic

### 5.1 Shop Discovery by Location

```
Input: consumerLat, consumerLon, radiusMeters, optional shopType filter

Query:
  SELECT shops.*, 
         ST_Distance(
             ST_MakePoint(longitude, latitude)::geography,
             ST_MakePoint(:lon, :lat)::geography
         ) AS distance_meters
  FROM shops
  JOIN merchant_accounts ON shops.merchant_id = merchant_accounts.id
  WHERE merchant_accounts.status = 'verified'
    AND ST_DWithin(
            ST_MakePoint(longitude, latitude)::geography,
            ST_MakePoint(:lon, :lat)::geography,
            :radius_meters
        )
    AND (shop_type = :shopType OR :shopType IS NULL)
  ORDER BY distance_meters ASC
  LIMIT :page_size OFFSET :offset

Post-query:
  For each shop in results:
    1. Compute open status (ComputeOpenStatusAsync — see §5.3)
    2. Fetch delivery logic (batch query — single IN clause for all shop IDs)
    3. Calculate base delivery fee (see §5.4)
  Return enriched list
```

### 5.2 Shop Detail (Inventory Tree)

```
Input: shopId, optional consumerLat/Lon

1. Fetch shop (must be verified)
2. Compute open status
3. Fetch all active categories for shop (ordered by name)
4. For each category:
   - Fetch all active merchant_items linked to this category (via merchant_item_categories)
   - Sort by sort_order ASC, then name ASC
5. If consumerLat/Lon provided:
   - Calculate delivery fee
6. Fetch average rating and review count from reviews table
7. Return ShopDetailDto with nested categories + items
```

### 5.3 Open Status Computation

```csharp
// Domain service — pure function, no DB calls
public static bool ComputeIsOpen(Shop shop, DateTimeOffset utcNow)
{
    return shop.OpenStatusMode switch
    {
        OpenStatusMode.ManualOpen   => true,
        OpenStatusMode.ManualClosed => false,
        OpenStatusMode.Auto         => ComputeFromSchedule(shop.OpeningHours, utcNow)
    };
}

private static bool ComputeFromSchedule(OpeningHoursSchedule? schedule, DateTimeOffset utcNow)
{
    if (schedule is null) return true; // no schedule = always open
    var daySchedule = schedule.GetDay(utcNow.DayOfWeek);
    if (!daySchedule.IsOpen) return false;
    var currentTime = TimeOnly.FromTimeSpan(utcNow.TimeOfDay);
    return currentTime >= daySchedule.Open && currentTime <= daySchedule.Close;
}
```

### 5.4 Delivery Fee Calculation (mirrors TypeScript `deliveryLogicService.ts`)

This is a pure domain function — no DB calls. Receives `ShopDeliveryLogic` and coordinates.

```
Step 1: Calculate straight-line distance (Haversine formula)
  R = 6371000 (meters)
  distance = 2R * atan2(sqrt(a), sqrt(1-a))

Step 2: Check free delivery
  if subtotalPkr >= freeDeliveryThreshold AND distance <= freeDeliveryRadius:
    return { baseFee: 0, surcharge: 0, freeDelivery: true, finalFee: 0 }

Step 3: Find matching distance tier (sorted ascending by maxDistance)
  for each tier in distanceTiers (sorted by maxDistance ASC):
    if distance <= tier.maxDistance:
      baseFee = min(tier.fee, maxDeliveryFee)
      break

Step 4: If beyond all tiers:
  extraDistance = distance - lastTier.maxDistance
  extraUnits = ceil(extraDistance / beyondTierDistanceUnit)
  baseFee = min(lastTier.fee + extraUnits * beyondTierFeePerUnit, maxDeliveryFee)

Step 5: Calculate surcharge
  if subtotalPkr < minimumOrderValue:
    surcharge = smallOrderSurcharge
  else:
    surcharge = 0

Step 6: Return { baseFee, surcharge, freeDelivery: false, finalFee: baseFee + surcharge }
```

### 5.5 Order Placement Flow

```
Input: userId, PlaceOrderRequest

1. Validate request (FluentValidation)

2. Verify minimum order value (least_order_value):
   a. Fetch item prices (batch query: merchant_items WHERE id IN (itemIds))
   b. Calculate subtotal_cents = sum(price * quantity)
   c. Fetch delivery logic for shopId
   d. if subtotalPkr < leastOrderValue → Result.Failure("Minimum order is PKR {leastOrderValue}")

3. Calculate full order totals:
   a. Fetch consumer_address (latitude, longitude)
   b. Fetch shop (latitude, longitude)
   c. Calculate distanceMeters (Haversine)
   d. Apply delivery fee logic (§5.4)
   e. total_cents = subtotal + deliveryFee + surcharge

4. Fetch user profile snapshot (name, email → customer_name, customer_email)

5. Create delivery_address JSONB snapshot from address row

6. Generate order_number via IOrderNumberGenerator (DB sequence)

7. Insert order row (status = 'pending')

8. Insert order_items rows (snapshot: name, description, image_url, price_cents from merchant_items)

9. Commit (both inserts in same transaction)

10. Publish side effects (AFTER commit):
    a. _hubContext.Clients.Group($"shop-orders:{shopId}").SendAsync("NewOrder", orderDto)
    b. _notificationService.SendAsync(merchantUserId, "New Order", "You have a new order #{orderNumber}")

11. Return Result.Success(ConsumerOrderDto)
```

### 5.6 Consumer Order Cancellation

```
Allowed only if status == 'pending'
(consumer cannot cancel once confirmed — merchant has accepted)

1. Fetch order by id WHERE user_id = userId (ownership check)
2. if order.Status != Pending → Result.Failure("Order cannot be cancelled at this stage")
3. Update: status = Cancelled, cancelled_at = UtcNow, cancellation_reason, cancelled_by = userId
4. SaveChangesAsync()
5. Push SignalR event to shop-orders group (merchant notified)
6. FCM notification to merchant: "Order #{number} was cancelled by customer"
7. Return Result.Success()
```

### 5.7 Stock Validation (Pre-Placement)

Before placing an order, items must be validated:

```
For each item in request.Items:
  1. Fetch merchant_item WHERE id = itemId AND shop_id = shopId
  2. If not found → Result.Failure("Item {name} is no longer available")
  3. If is_active == false → Result.Failure("Item {name} is no longer available")
  4. If price_cents != 0 AND item is in request → OK (no quantity/stock tracking in v1)
```

---

## 6. Notification Service Logic

### 6.1 FCM Push Notification Flow

```
1. Fetch notification_preferences for userId + role
   If allow_push_notifications == false → skip (return without error)

2. Fetch device_tokens for userId (all platforms)
   If no tokens → skip

3. For each device token:
   - Build FirebaseAdmin.Messaging.Message with title, body, data payload
   - Call FirebaseMessaging.DefaultInstance.SendAsync(message)
   - On success: log to notification_audit_log with status='sent'
   - On failure: log to notification_audit_log with status='failed', error_message
```

### 6.2 Order Event Notifications

| Event | Recipient | Title | Body |
|---|---|---|---|
| Order placed | Merchant | "New Order!" | "Order #{number} received" |
| Order confirmed | Consumer | "Order Confirmed" | "#{number} has been confirmed" |
| Order out for delivery | Consumer | "On the Way!" | "Your order is out for delivery" |
| Order delivered | Consumer | "Delivered!" | "Your order #{number} has been delivered" |
| Order cancelled by merchant | Consumer | "Order Cancelled" | "#{number} was cancelled" |
| Order cancelled by consumer | Merchant | "Order Cancelled" | "#{number} was cancelled by customer" |

---

## 7. Controller Routes

**Route prefix:** `/api/v1/consumer`  
**Authorization:** All require `[Authorize(Roles = "consumer")]` unless noted

### Profile
| Method | Route | Description |
|---|---|---|
| `GET` | `/profile` | Get own profile |
| `PUT` | `/profile` | Update name |

### Addresses
| Method | Route | Description |
|---|---|---|
| `GET` | `/addresses` | List saved addresses |
| `GET` | `/addresses/{addressId}` | Get single address |
| `POST` | `/addresses` | Create address |
| `PUT` | `/addresses/{addressId}` | Update address |
| `DELETE` | `/addresses/{addressId}` | Delete address |

### Shops (read-only — `[Authorize]` only, not role-specific)
| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/shops` | `[Authorize]` | Discover shops by location (query: lat, lon, radius, type) |
| `GET` | `/shops/{shopId}` | `[Authorize]` | Shop detail with inventory tree |

### Orders
| Method | Route | Description |
|---|---|---|
| `POST` | `/orders/calculate` | Preview fee calculation (no order created) |
| `POST` | `/orders` | Place new order |
| `GET` | `/orders` | List own order history |
| `GET` | `/orders/active` | Get active (non-terminal) order |
| `GET` | `/orders/{orderId}` | Get order by ID |
| `POST` | `/orders/{orderId}/cancel` | Cancel a pending order |

### Reviews
| Method | Route | Description |
|---|---|---|
| `POST` | `/reviews` | Submit review for a shop |
| `GET` | `/shops/{shopId}/reviews` | List reviews for a shop |

### Notifications
| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/notification-preferences` | `[Authorize]` | Get notification preferences |
| `PUT` | `/notification-preferences` | `[Authorize]` | Update preferences |

---

## 8. SignalR — Consumer Order Tracking

When a consumer opens the active order tracking screen:
1. App calls `hubConnection.invoke("JoinOrderGroup", orderId)`
2. Listens for `"OrderStatusChanged"` events → updates UI
3. On disconnect: `hubConnection.invoke("LeaveOrderGroup", orderId)`

The server sends `"OrderStatusChanged"` after every merchant order status transition (see Merchant Module §5.4).

---

## 9. Migration Plan — Consumer Module

### Step 1: Database Migration
- Add consumer-side EF entities: `ConsumerAddress`, `Review`, `NotificationPreference`, `NotificationAuditLog`
- Validate FK references to `AspNetUsers` and `shops` tables
- Run `dotnet ef migrations add AddConsumerTables`

### Step 2: Profile & Addresses
- Implement `ConsumerProfileService` — reads from `user_profiles` (same table as auth module)
- Implement `ConsumerAddressService` with full CRUD
- Test: CRUD operations + ownership check prevents access to other users' addresses

### Step 3: Shop Discovery
- Implement `ConsumerShopService.FindByLocationAsync()` using PostGIS `ST_DWithin`
- Implement open status computation (pure domain function)
- Implement batch delivery fee calculation
- Test: shops outside radius are excluded; unverified shops are excluded; fee matches TypeScript output

### Step 4: Order Placement
- Implement `ConsumerOrderService.PlaceOrderAsync()` with the full transactional flow
- Implement `IOrderNumberGenerator` using PostgreSQL sequence
- Test: place order → order_items created, order_number unique, fee correct, merchant SignalR event sent

### Step 5: Order Tracking
- Implement `GetActiveOrderAsync()`, `GetOrderByIdAsync()`
- Verify consumer SignalR events fire on merchant status transitions (integration test)
- Test: consumer cancels pending order → merchant receives SignalR + FCM notification

### Step 6: FCM Notifications
- Install `FirebaseAdmin` NuGet package
- Initialize Firebase app in `Infrastructure` with service account key (path from environment variable)
- Implement `NotificationService.SendOrderNotificationAsync()`
- Test: place order → merchant FCM token receives "New Order" notification

### Step 7: Reviews
- Implement `ReviewService` — one review per user per shop (or per order)
- Test: submit review → returns in shop detail average rating

### Step 8: Notification Preferences
- Implement `NotificationPreferenceService` (upsert pattern)
- Test: set `allow_push_notifications = false` → FCM call is skipped for that user
