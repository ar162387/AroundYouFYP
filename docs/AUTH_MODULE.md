# Module: Authentication & Authorization

> **Phase:** 1 (First to implement)  
> **Standard:** Per `backend/SOP's.md`  
> **Source Mapping:** `src/services/authService.ts`, `src/context/AuthContext.tsx`

---

## 1. Overview

This module replaces Supabase Auth entirely. It owns:
- User registration (email/password and Google OAuth)
- Session management (JWT issuance and validation)
- Role-based access control (`consumer`, `merchant`, `admin`)
- User profile lifecycle (create on register, update, delete account with cascade)
- Device token management (for push notifications)

**Identity Provider:** ASP.NET Core Identity with a custom `AppUser : IdentityUser<Guid>` entity.  
**Token Format:** JWT Bearer tokens with role claims; no server-side session state.

---

## 2. Entities (Domain Layer)

### `AppUser` (extends `IdentityUser<Guid>`)

```
Properties inherited from IdentityUser<Guid>:
  Id               Guid        PK
  Email            string
  NormalizedEmail  string
  UserName         string      (set to Email)
  PasswordHash     string
  EmailConfirmed   bool        (always true — no email confirmation flow)
  SecurityStamp    string

Custom extension:
  CreatedAt        DateTimeOffset
```

### `UserProfile`

```
Id          Guid          PK
UserId      Guid          FK → AppUser.Id (unique — 1:1)
Email       string?
Name        string?
Role        UserRole      enum: consumer | merchant | admin
CreatedAt   DateTimeOffset
UpdatedAt   DateTimeOffset
```

### `DeviceToken`

```
Id          Guid          PK
UserId      Guid          FK → AppUser.Id
Token       string        Unique (FCM registration token)
Platform    string        'ios' | 'android'
CreatedAt   DateTimeOffset
UpdatedAt   DateTimeOffset
```

### Enums (Domain Layer)

```csharp
public enum UserRole { Consumer, Merchant, Admin }
public enum DevicePlatform { Ios, Android }
```

---

## 3. DTOs (Application Layer)

### Request DTOs

```csharp
// POST /api/v1/auth/register
RegisterRequest
  Email       string   Required, valid email format
  Password    string   Required, min 8 chars, must contain letter + digit
  Name        string?  Optional

// POST /api/v1/auth/login
LoginRequest
  Email       string   Required
  Password    string   Required

// POST /api/v1/auth/google
GoogleSignInRequest
  IdToken     string   Required — Google ID token from mobile GoogleSignin SDK

// POST /api/v1/auth/logout
LogoutRequest
  DeviceToken string?  Optional — FCM token to remove on logout

// PUT /api/v1/auth/me
UpdateProfileRequest
  Name        string?  Optional

// POST /api/v1/auth/device-token
RegisterDeviceTokenRequest
  Token       string   Required
  Platform    string   Required: 'ios' | 'android'

// DELETE /api/v1/auth/device-token
RemoveDeviceTokenRequest
  Token       string   Required
```

### Response DTOs

```csharp
// Returned on login, register, google sign-in
AuthResponse
  AccessToken  string         JWT Bearer token
  ExpiresAt    DateTimeOffset Token expiry
  User         UserDto

UserDto
  Id           Guid
  Email        string
  Name         string?
  Role         string         'consumer' | 'merchant' | 'admin'
  CreatedAt    DateTimeOffset
```

---

## 4. Validators (Application Layer — FluentValidation)

### `RegisterRequestValidator`
- `Email` → `NotEmpty()`, `EmailAddress()`
- `Password` → `NotEmpty()`, `MinimumLength(8)`, `Matches(@"[a-zA-Z]")`, `Matches(@"[0-9]")`
- `Name` → `MaximumLength(100)` when provided

### `LoginRequestValidator`
- `Email` → `NotEmpty()`, `EmailAddress()`
- `Password` → `NotEmpty()`

### `GoogleSignInRequestValidator`
- `IdToken` → `NotEmpty()`, `MinimumLength(50)`

### `UpdateProfileRequestValidator`
- `Name` → `MaximumLength(100)` when provided

### `RegisterDeviceTokenRequestValidator`
- `Token` → `NotEmpty()`, `MaximumLength(500)`
- `Platform` → `NotEmpty()`, `Must(p => p is "ios" or "android")`

---

## 5. Service Interface (Application Layer)

```csharp
public interface IAuthService
{
    Task<Result<AuthResponse>> RegisterAsync(RegisterRequest request);
    Task<Result<AuthResponse>> LoginAsync(LoginRequest request);
    Task<Result<AuthResponse>> GoogleSignInAsync(GoogleSignInRequest request);
    Task<Result<UserDto>> GetCurrentUserAsync(Guid userId);
    Task<Result> UpdateProfileAsync(Guid userId, UpdateProfileRequest request);
    Task<Result> DeleteAccountAsync(Guid userId);
    Task<Result> LogoutAsync(Guid userId, string? deviceToken);
}

public interface IDeviceTokenService
{
    Task<Result> RegisterTokenAsync(Guid userId, RegisterDeviceTokenRequest request);
    Task<Result> RemoveTokenAsync(Guid userId, string token);
    Task<Result> RemoveAllTokensForUserAsync(Guid userId);
}
```

---

## 6. Business Logic (Application Layer)

### 6.1 Registration Flow

```
Input: email, password, name?

1. Validate request (FluentValidation — auto-wired; controller never sees invalid input)
2. Check if email already registered → Result.Failure("Email already in use") if duplicate
3. Create AppUser via UserManager.CreateAsync(user, password)
   - EmailConfirmed = true (mobile flow — no email verification)
   - CreatedAt = DateTimeOffset.UtcNow
4. If UserManager fails → return Result.Failure(identity errors joined)
5. Create UserProfile row (same transaction — not a trigger):
   - UserId = new user.Id
   - Email = request.Email
   - Name = request.Name
   - Role = UserRole.Consumer (default)
6. Issue JWT (see §6.5)
7. Return Result.Success(AuthResponse)
```

### 6.2 Email/Password Login Flow

```
Input: email, password

1. Validate request
2. Find AppUser by normalized email via UserManager.FindByEmailAsync()
   → Result.Failure("Invalid credentials") if not found (never reveal "email not found")
3. Check password via SignInManager.CheckPasswordSignInAsync()
   → Result.Failure("Invalid credentials") if wrong password
4. Fetch UserProfile to get role and name
5. Issue JWT
6. Return Result.Success(AuthResponse)
```

### 6.3 Google Sign-In Flow

```
Input: Google ID token (from mobile GoogleSignin SDK)

1. Validate ID token against Google's OAuth2 endpoint
   URL: https://oauth2.googleapis.com/tokeninfo?id_token={token}
   → Result.Failure("Invalid Google token") if validation fails
2. Extract email and name from token payload
3. Attempt to find existing AppUser by email
4. If not found → create new AppUser (same as registration but no password; 
   ExternalLogins table entry created for 'Google' provider)
5. If found → update name from Google if local name is null
6. Fetch or create UserProfile (ensure role = consumer for new users)
7. Issue JWT
8. Return Result.Success(AuthResponse)
```

### 6.4 Delete Account Flow

```
Input: userId (from JWT claim)

1. Begin EF Core transaction
2. Delete notification cleanup (remove device tokens)
3. Delete consumer_addresses
4. Update orders (set user_id to null? OR cascade — design decision: SET NULL on FK)
5. Delete user_profiles row
6. Delete AppUser via UserManager.DeleteAsync()
7. Commit transaction
8. Return Result.Success()

Note: orders are preserved with user_id = null (customer snapshot in JSON is intact)
```

### 6.5 JWT Generation

```csharp
Claims issued:
  sub       = user.Id.ToString()
  email     = user.Email
  name      = profile.Name ?? string.Empty
  role      = profile.Role.ToString().ToLower()  // "consumer" / "merchant" / "admin"
  jti       = Guid.NewGuid().ToString()          // unique token ID
  iat       = DateTimeOffset.UtcNow
  exp       = DateTimeOffset.UtcNow.AddDays(7)   // configurable via appsettings

Signing:
  Algorithm: HS256
  Key: from appsettings/secrets: Jwt:Secret (min 32 chars)
  Issuer: Jwt:Issuer (e.g., "https://api.ay.pk")
  Audience: Jwt:Audience (e.g., "ay-mobile")
```

### 6.6 Google ID Token Validation

The .NET backend validates the Google ID token by calling Google's token info endpoint (or using the `Google.Apis.Auth` NuGet package's `GoogleJsonWebSignature.ValidateAsync()`). It does **not** pass the token to Supabase.

```csharp
var payload = await GoogleJsonWebSignature.ValidateAsync(
    request.IdToken,
    new GoogleJsonWebSignature.ValidationSettings
    {
        Audience = new[] { _config["Google:ClientId"] }
    }
);
// payload.Email, payload.Name available
```

---

## 7. Repository Interfaces (Domain Layer)

```csharp
public interface IUserProfileRepository
{
    Task<UserProfile?> GetByUserIdAsync(Guid userId);
    Task<UserProfile> CreateAsync(UserProfile profile);
    Task<UserProfile> UpdateAsync(UserProfile profile);
    Task DeleteByUserIdAsync(Guid userId);
}

public interface IDeviceTokenRepository
{
    Task<List<DeviceToken>> GetByUserIdAsync(Guid userId);
    Task UpsertAsync(DeviceToken token);  // insert or update on token conflict
    Task DeleteByTokenAsync(string token);
    Task DeleteAllForUserAsync(Guid userId);
}
```

---

## 8. Controller (WebApi Layer)

**Route prefix:** `/api/v1/auth`

| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/register` | None | Create new account |
| `POST` | `/login` | None | Email/password login |
| `POST` | `/google` | None | Google OAuth sign-in |
| `POST` | `/logout` | `[Authorize]` | Clean up tokens, client discards JWT |
| `GET` | `/me` | `[Authorize]` | Get current user profile |
| `PUT` | `/me` | `[Authorize]` | Update name |
| `DELETE` | `/me` | `[Authorize]` | Delete account and all data |
| `POST` | `/device-token` | `[Authorize]` | Register FCM token |
| `DELETE` | `/device-token` | `[Authorize]` | Remove FCM token |

**Controller contract (thin — no logic):**
```csharp
[ApiController]
[Route("api/v1/auth")]
public class AuthController(IAuthService authService, IDeviceTokenService deviceTokenService)
    : ControllerBase
{
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var result = await authService.RegisterAsync(request);
        return result.IsSuccess ? Ok(result.Value) : Problem(result.Error);
    }
    // ... same pattern for all endpoints
}
```

---

## 9. Authorization Policy Setup

```csharp
// In Program.cs
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("ConsumerOnly",  p => p.RequireRole("consumer"));
    options.AddPolicy("MerchantOnly",  p => p.RequireRole("merchant"));
    options.AddPolicy("AdminOnly",     p => p.RequireRole("admin"));
});
```

Usage on controllers:
```csharp
[Authorize(Policy = "MerchantOnly")]
[ApiController]
[Route("api/v1/merchant")]
public class MerchantController(...) : ControllerBase { }
```

---

## 10. Migration Plan — Auth

### Step 1: EF Core Setup
- Configure `AppDbContext : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>`
- Add connection string to User Secrets
- Run `dotnet ef migrations add InitialIdentity`
- Verify `AspNetUsers` and all Identity tables are created

### Step 2: User Profile Table
- Add `UserProfile` entity with Fluent API configuration
- Add `IUserProfileRepository` and its EF implementation
- Run `dotnet ef migrations add AddUserProfiles`

### Step 3: Auth Service Implementation
- Implement `AuthService` with register, login, Google sign-in
- Write unit tests: register → profile created, login → JWT issued, duplicate email → failure

### Step 4: JWT Middleware
- Configure `AddAuthentication().AddJwtBearer()` in `Program.cs`
- Validate all JWT settings (issuer, audience, signing key)
- Test: valid token → 200, expired token → 401, no token → 401

### Step 5: Role-Based Authorization
- Add `[Authorize(Roles = "consumer")]` to consumer routes
- Add `[Authorize(Roles = "merchant")]` to merchant routes
- Test: consumer JWT cannot access merchant endpoints (403)

### Step 6: Google OAuth
- Install `Google.Apis.Auth` NuGet
- Implement Google token validation in `AuthService.GoogleSignInAsync()`
- Test with real ID token from mobile app

### Step 7: Account Deletion
- Implement cascade delete transaction
- Test: delete user → all related rows gone, orders preserved with null user_id

### Step 8: Device Token Endpoints
- Implement `DeviceTokenService` and controller endpoints
- These are needed before Phase 3 (notifications)

---

## 11. Security Notes

- Passwords are hashed by ASP.NET Core Identity (BCrypt + PBKDF2). Never stored in plaintext.
- JWT secret must be at minimum 32 characters (256-bit). Set via environment variable on VPS.
- Token expiry is 7 days for mobile (long-lived; matches Supabase session behavior). Add refresh token in v2 if needed.
- Email/password login always returns the same error message for wrong email AND wrong password — prevents email enumeration.
- Google ID tokens are validated server-side via `GoogleJsonWebSignature.ValidateAsync()`. The mobile app never sends raw Google credentials.
- Account deletion is irreversible. The service does not require re-authentication, but the endpoint requires `[Authorize]`.
