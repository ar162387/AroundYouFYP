# System Architecture — Ay Backend (.NET Monolith)

> **Status:** Pre-Implementation Reference Document  
> **Standard:** Strictly enforced per `backend/SOP's.md`  
> **Scope:** Supabase → Self-hosted PostgreSQL migration. No AI features in this cycle.

---

## 1. Solution Overview

The Ay backend is a **single deployable .NET monolith** structured as a Clean Architecture solution. It replaces all Supabase-managed services (authentication, database, real-time, storage) with owned infrastructure.

```
Solution: Ay.sln
│
├── Ay.Domain          (Zero external dependencies)
├── Ay.Application     (Depends on Domain only)
├── Ay.Infrastructure  (Depends on Application + Domain)
└── Ay.WebApi          (Depends on Application + Infrastructure)
```

The four-project rule from SOP's.md is **non-negotiable**. No fifth project may be added without revising this document.

---

## 2. Layer Responsibilities

### 2.1 `Ay.Domain`

The innermost, purest layer. Contains only C# types — no NuGet packages except for language helpers (e.g., `System`).

**Contains:**
- **Entities** — Maps 1-to-1 with database tables. No data annotations. No EF attributes.
- **Enums** — `UserRole`, `OrderStatus`, `PaymentMethod`, `ShopType`, `MerchantVerificationStatus`, `NotificationPlatform`, `OpenStatusMode`, `DistanceMode`
- **Value Objects** — `DistanceTier`, `DeliveryAddress` (immutable structs or records)
- **Domain Exceptions** — Custom exception types (e.g., `DomainException`, `OrderTransitionException`)
- **Repository Interfaces** — `IUserRepository`, `IShopRepository`, `IOrderRepository`, etc.
- **Service Interfaces** — `IDeliveryFeeCalculator`, `IOrderNumberGenerator`
- **Result Pattern** — `Result<T>` and `Result` wrapper types used across all layers

**Dependency rule:** Imports **nothing** outside the BCL.

---

### 2.2 `Ay.Application`

Orchestrates domain objects to fulfil use cases. Contains no infrastructure concerns (no EF, no HTTP clients).

**Contains:**
- **DTOs** — Request and Response objects for every API operation
- **Mapping Profiles** — Mapster configuration mapping Entities ↔ DTOs
- **Validators** — FluentValidation `AbstractValidator<TRequest>` classes for every incoming DTO
- **Service Interfaces** — `IAuthService`, `IMerchantService`, `IOrderService`, etc.
- **Service Implementations** — Concrete classes implementing the service interfaces; all logic lives here
- **Use-Case Orchestration** — Multi-step operations (e.g., PlaceOrder coordinates price calculation, stock check, order insert, and notification dispatch)

**Dependency rule:** Depends on `Ay.Domain` only. Never references EF Core or HTTP clients directly.

---

### 2.3 `Ay.Infrastructure`

All I/O, persistence, and external integrations. This is the only layer that knows about PostgreSQL, JWT, FCM, or file storage.

**Contains:**
- **`AppDbContext`** — EF Core `DbContext`; all entity configuration via Fluent API in `OnModelCreating`
- **Repository Implementations** — `UserRepository : IUserRepository`, etc.
- **EF Migrations** — Managed via `dotnet ef migrations`
- **Identity Setup** — `AspNetUsers` table integration, password hashing, claims
- **JWT Provider** — Token generation and validation
- **FCM Client** — Firebase Cloud Messaging push notification sender
- **File Storage** — Cloudinary uploads for merchant shop/item images (`IFileStorageService`)
- **Background Services** — `IHostedService` implementations (e.g., webhook event outbox processor)
- **DI Registration** — `InfrastructureServiceExtensions.AddInfrastructure(IServiceCollection)` extension method

**Dependency rule:** Depends on `Ay.Application` and `Ay.Domain`.

---

### 2.4 `Ay.WebApi`

The entry point and HTTP boundary. Contains zero business logic.

**Contains:**
- **Controllers** — One controller per resource group; thin, delegate to Application services
- **`Program.cs`** — Service registration, middleware pipeline, SignalR hub mapping
- **Middleware** — `GlobalExceptionMiddleware` (catches unhandled exceptions, returns `ProblemDetails`)
- **SignalR Hubs** — `OrderHub` for real-time order status push
- **API Versioning** — URL-based (`/api/v1/`)
- **`appsettings.json`** / `appsettings.Development.json` — Non-secret configuration
- **User Secrets / Environment Variables** — Connection strings, JWT secret, FCM key

**Dependency rule:** Depends on `Ay.Application` and `Ay.Infrastructure` (for DI wiring only).

---

## 3. Project Dependency Graph

```
                     ┌───────────────────┐
                     │    Ay.WebApi       │
                     │  (Controllers,     │
                     │   Middleware,      │
                     │   SignalR Hubs,    │
                     │   Program.cs)      │
                     └────────┬──────────┘
                              │ depends on
               ┌──────────────┴──────────────┐
               ▼                             ▼
  ┌────────────────────┐      ┌───────────────────────┐
  │  Ay.Infrastructure  │      │    Ay.Application      │
  │  (EF Core, Repos,  │      │  (Services, DTOs,      │
  │   JWT, FCM, Files) │      │   Validators, Mapster) │
  └──────────┬─────────┘      └────────────┬──────────┘
             │ depends on                  │ depends on
             └──────────────┬──────────────┘
                            ▼
                   ┌─────────────────┐
                   │   Ay.Domain      │
                   │ (Entities, Enums,│
                   │  Interfaces,     │
                   │  Result<T>)      │
                   └─────────────────┘
```

---

## 4. Technology Stack

| Concern | Technology | Notes |
|---|---|---|
| Runtime | .NET 10 | Use `net10.0` TFM |
| Web Framework | ASP.NET Core 10 | Minimal API controllers |
| ORM | Entity Framework Core 10 + Npgsql | Fluent API configuration; no Data Annotations on entities |
| Database | PostgreSQL 16 (local) | Replaces Supabase-hosted Postgres |
| Authentication | ASP.NET Core Identity + JWT Bearer | Replaces `supabase.auth.*` |
| Mapping | Mapster | Maps Entities ↔ DTOs; registered via `TypeAdapterConfig` |
| Validation | FluentValidation | Registered via `AddFluentValidationAutoValidation()` |
| Real-Time | ASP.NET Core SignalR | Replaces Supabase Realtime; `OrderHub` |
| Push Notifications | Firebase Admin SDK (.NET) | Replaces Supabase Edge Functions calling FCM |
| File Storage | Cloudinary | Merchant shop/item images via `IFileStorageService` → HTTPS URLs in DB |
| Error Responses | ProblemDetails (RFC 7807) | All error bodies conform to this spec |
| API Versioning | `Asp.Versioning.Mvc` | URL-based `/api/v1/` |
| Logging | `Microsoft.Extensions.Logging` + Serilog | Structured logging to file and console |
| Health Checks | `Microsoft.AspNetCore.Diagnostics.HealthChecks` | `/health` endpoint |

---

## 5. API Versioning Strategy

All routes are prefixed with `/api/v1/`. When breaking changes are required, a new version namespace (`/api/v2/`) is added. The mobile app's existing version continues to be served by `/api/v1/` until deprecated.

```
/api/v1/auth/register
/api/v1/auth/login
/api/v1/auth/google
/api/v1/auth/logout
/api/v1/auth/me
/api/v1/auth/delete-account

/api/v1/merchant/account
/api/v1/merchant/shops
/api/v1/merchant/shops/{shopId}/inventory
/api/v1/merchant/shops/{shopId}/delivery-logic
/api/v1/merchant/shops/{shopId}/orders
/api/v1/merchant/shops/{shopId}/runners

/api/v1/consumer/profile
/api/v1/consumer/addresses
/api/v1/consumer/shops
/api/v1/consumer/shops/{shopId}
/api/v1/consumer/orders
/api/v1/consumer/reviews

/api/v1/notifications/preferences
/api/v1/notifications/device-tokens
```

---

## 6. Real-Time Architecture (SignalR)

Supabase Realtime's `postgres_changes` subscriptions are replaced by SignalR. The pattern:

1. A client (mobile app) connects to the `OrderHub` and joins a group (e.g., `order:{orderId}` or `shop:{shopId}`).
2. When the backend updates an order's status, the `IOrderService` calls `IHubContext<OrderHub>` to push a message to the relevant group.
3. Both consumer and merchant clients receive real-time status changes without polling.

**Hub Groups:**
- `order:{orderId}` — Consumer tracking a specific order
- `shop-orders:{shopId}` — Merchant dashboard watching all shop orders

**CORS:** SignalR hub is configured to allow the same origins as the REST API. Both mobile and web frontends are listed explicitly in the allowed origins.

---

## 7. Global Error Handling

A single `GlobalExceptionMiddleware` sits at the top of the ASP.NET Core pipeline. It catches any unhandled exception and returns a `ProblemDetails` response.

```
HTTP 500 Response Body:
{
  "type": "https://tools.ietf.org/html/rfc7807",
  "title": "An unexpected error occurred.",
  "status": 500,
  "traceId": "00-abc123..."
}
```

Business failures (e.g., "Order not found", "Insufficient stock") **never throw exceptions**. They return `Result.Failure("message")` from the Application layer, which the controller translates into a `404` or `422` with a `ProblemDetails` body.

---

## 8. Authentication Flow

```
Mobile App                     Ay.WebApi
    │                              │
    │── POST /api/v1/auth/login ──►│
    │                              │── IAuthService.LoginAsync()
    │                              │   ├─ Validate credentials (Identity)
    │                              │   ├─ Fetch user_profiles row (role)
    │                              │   └─ Generate JWT (sub, email, role claims)
    │◄── { accessToken, user } ───│
    │                              │
    │── GET /api/v1/consumer/... ─►│  Authorization: Bearer <token>
    │                              │── [Authorize(Roles = "consumer")]
    │                              │   └─ JWT middleware validates + injects claims
    │◄── 200 OK ──────────────────│
```

**JWT Claims issued:**
- `sub` — User's UUID (matches `AspNetUsers.Id`)
- `email` — User's email
- `role` — `consumer` | `merchant` | `admin`
- `name` — Display name
- `jti` — Unique token ID (for future revocation)
- `exp` — Expiry (configurable; default 7 days for mobile)

---

## 9. Configuration Hierarchy

```
appsettings.json              ← committed to source control (non-sensitive defaults)
appsettings.Development.json  ← committed, development overrides
User Secrets (dev)            ← never committed; local machine only
Environment Variables (prod)  ← set on VPS/server; override all above
```

**Required secrets (never hardcoded):**
- `ConnectionStrings:Default` — PostgreSQL connection string
- `Jwt:Secret` — Signing key (min 32 chars)
- `Firebase:ServiceAccountKeyPath` — Path to FCM service account JSON
- `Google:ClientId` — For Google OAuth token validation

---

## 10. File Storage Convention

Merchant **shop** and **inventory item** images are uploaded through `MerchantUploadsController`, persisted via **Cloudinary**, and the API stores the returned **secure HTTPS URL** on the shop or item row. Configure `CLOUDINARY_URL` or `Cloudinary:Url` (same `cloudinary://…` string as in the Cloudinary console).

`UseStaticFiles()` remains enabled so any **legacy** rows that still reference `/uploads/...` can be served from `wwwroot` until those assets are replaced; new uploads do not write to local disk.

---

## 11. Development Roadmap Phases

| Phase | Modules | Key Deliverables |
|---|---|---|
| **Phase 1** | Authentication & Authorization | Identity setup, JWT, register/login/Google OAuth, role assignment, token refresh, delete account |
| **Phase 2** | Merchant Logic | Merchant account CRUD, shop management, inventory management, delivery logic & runners, order management (merchant view), analytics |
| **Phase 3** | Consumer Logic | Consumer profile, address management, shop discovery (by location), shop detail, order placement & tracking, reviews, notification preferences |

Each phase must be fully documented (this `/docs` directory) **before** any implementation begins, per project constraints.

---

## 12. Non-Functional Requirements

| Requirement | Target |
|---|---|
| All async | Every DB call and I/O must use `async/await`. `.Result` and `.Wait()` are banned. |
| No logic in controllers | Controllers call one service method and return. All orchestration is in Application layer. |
| No `new` for services | All dependencies injected via constructor (primary constructor syntax). |
| No entity in API response | Entities are always mapped to DTOs before returning. |
| Validated inputs | Every request DTO has a FluentValidation validator registered. Requests reaching service layer are guaranteed valid. |
| Structured logging | All significant events and errors are logged with structured properties (no raw string concatenation). |
| Health check endpoint | `GET /health` returns liveness status, including DB connectivity. |
