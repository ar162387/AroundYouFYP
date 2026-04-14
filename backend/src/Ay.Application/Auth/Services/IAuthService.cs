using System.Security.Claims;
using Ay.Application.Auth.DTOs;
using Ay.Domain.Common;

namespace Ay.Application.Auth.Services;

public interface IAuthService
{
    Task<Result<AuthResponse>> RegisterAsync(RegisterRequest request);
    Task<Result<AuthResponse>> LoginAsync(LoginRequest request);
    Task<Result<AuthResponse>> GoogleSignInAsync(GoogleSignInRequest request);
    Task<Result<AuthMeDto>> GetCurrentUserAsync(Guid userId, ClaimsPrincipal bearer);
    Task<Result> UpdateProfileAsync(Guid userId, UpdateProfileRequest request);
    Task<Result> DeleteAccountAsync(Guid userId);
}
