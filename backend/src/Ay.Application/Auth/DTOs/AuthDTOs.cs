namespace Ay.Application.Auth.DTOs;

public record RegisterRequest(string Email, string Password, string? Name);

public record LoginRequest(string Email, string Password);

public record GoogleSignInRequest(string IdToken);

public record UpdateProfileRequest(string? Name);

public record RegisterDeviceTokenRequest(string Token, string Platform);

public record RemoveDeviceTokenRequest(string Token);

public record AuthResponse(string AccessToken, DateTimeOffset ExpiresAt, UserDto User);

public record UserDto(Guid Id, string Email, string? Name, string Role, DateTimeOffset CreatedAt);

/// <summary>
/// Same fields as <see cref="UserDto"/> for JSON shape compatibility, plus optional session refresh when the
/// bearer JWT role is out of sync with the database profile (e.g. merchant upgrade without persisting the new token).
/// </summary>
public record AuthMeDto(
    Guid Id,
    string Email,
    string? Name,
    string Role,
    DateTimeOffset CreatedAt,
    string? AccessToken = null,
    DateTimeOffset? ExpiresAt = null);
