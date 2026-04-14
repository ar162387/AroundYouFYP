using System.Security.Claims;
using Ay.Application.Auth.DTOs;
using Ay.Application.Auth.Services;
using Ay.Domain.Common;
using Ay.Domain.Entities;
using Ay.Domain.Enums;
using Ay.Domain.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;

namespace Ay.Infrastructure.Identity;

public class AuthService(
    UserManager<AppUser> userManager,
    IUserProfileRepository profileRepo,
    IDeviceTokenRepository deviceTokenRepo,
    IJwtTokenGenerator jwtGenerator,
    ILogger<AuthService> logger) : IAuthService
{
    public async Task<Result<AuthResponse>> RegisterAsync(RegisterRequest request)
    {
        var existing = await userManager.FindByEmailAsync(request.Email);
        if (existing is not null)
            return Result.Failure<AuthResponse>("Email already in use.");

        var user = new AppUser
        {
            UserName = request.Email,
            Email = request.Email,
            EmailConfirmed = true,
            CreatedAt = DateTimeOffset.UtcNow
        };

        var identityResult = await userManager.CreateAsync(user, request.Password);
        if (!identityResult.Succeeded)
        {
            var errors = string.Join("; ", identityResult.Errors.Select(e => e.Description));
            return Result.Failure<AuthResponse>(errors);
        }

        var profile = new UserProfile
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Email = request.Email,
            Name = request.Name,
            Role = UserRole.Consumer
        };
        await profileRepo.CreateAsync(profile);

        var (token, expiresAt) = jwtGenerator.GenerateToken(
            user.Id, user.Email!, profile.Name, profile.Role.ToString().ToLower());

        var dto = new UserDto(
            user.Id,
            user.Email!,
            profile.Name,
            profile.PhoneNumber,
            profile.Role.ToString().ToLower(),
            user.CreatedAt);
        return Result.Success(new AuthResponse(token, expiresAt, dto));
    }

    public async Task<Result<AuthResponse>> LoginAsync(LoginRequest request)
    {
        var user = await userManager.FindByEmailAsync(request.Email);
        if (user is null)
            return Result.Failure<AuthResponse>("Invalid credentials.");

        var validPassword = await userManager.CheckPasswordAsync(user, request.Password);
        if (!validPassword)
            return Result.Failure<AuthResponse>("Invalid credentials.");

        var profile = await profileRepo.GetByUserIdAsync(user.Id);
        if (profile is null)
            return Result.Failure<AuthResponse>("User profile not found.");

        var (token, expiresAt) = jwtGenerator.GenerateToken(
            user.Id, user.Email!, profile.Name, profile.Role.ToString().ToLower());

        var dto = new UserDto(
            user.Id,
            user.Email!,
            profile.Name,
            profile.PhoneNumber,
            profile.Role.ToString().ToLower(),
            user.CreatedAt);
        return Result.Success(new AuthResponse(token, expiresAt, dto));
    }

    public async Task<Result<AuthMeDto>> GetCurrentUserAsync(Guid userId, ClaimsPrincipal bearer)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
            return Result.Failure<AuthMeDto>("User not found.");

        var profile = await profileRepo.GetByUserIdAsync(userId);
        if (profile is null)
            return Result.Failure<AuthMeDto>("User profile not found.");

        var role = profile.Role.ToString().ToLowerInvariant();
        var dto = new UserDto(user.Id, user.Email!, profile.Name, profile.PhoneNumber, role, user.CreatedAt);

        var bearerRole = bearer.FindFirstValue(ClaimTypes.Role) ?? bearer.FindFirstValue("role");
        if (string.Equals(bearerRole, role, StringComparison.OrdinalIgnoreCase))
            return Result.Success(new AuthMeDto(dto.Id, dto.Email, dto.Name, dto.PhoneNumber, dto.Role, dto.CreatedAt));

        var (token, expiresAt) = jwtGenerator.GenerateToken(
            user.Id, user.Email!, profile.Name, role);

        logger.LogInformation(
            "Reissued JWT for user {UserId}: bearer role {BearerRole} -> profile role {ProfileRole}",
            userId,
            bearerRole ?? "(none)",
            role);

        return Result.Success(new AuthMeDto(dto.Id, dto.Email, dto.Name, dto.PhoneNumber, dto.Role, dto.CreatedAt, token, expiresAt));
    }

    public async Task<Result> UpdateProfileAsync(Guid userId, UpdateProfileRequest request)
    {
        var profile = await profileRepo.GetByUserIdAsync(userId);
        if (profile is null)
            return Result.Failure("User profile not found.");

        if (request.Name is not null)
            profile.Name = request.Name;
        if (request.PhoneNumber is not null)
            profile.PhoneNumber = request.PhoneNumber;

        profile.UpdatedAt = DateTimeOffset.UtcNow;
        await profileRepo.UpdateAsync(profile);
        return Result.Success();
    }

    public async Task<Result> DeleteAccountAsync(Guid userId)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
            return Result.Failure("User not found.");

        try
        {
            await deviceTokenRepo.DeleteAllForUserAsync(userId);
            await profileRepo.DeleteByUserIdAsync(userId);

            var identityResult = await userManager.DeleteAsync(user);
            if (!identityResult.Succeeded)
            {
                var errors = string.Join("; ", identityResult.Errors.Select(e => e.Description));
                return Result.Failure(errors);
            }

            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to delete account for user {UserId}", userId);
            return Result.Failure("An error occurred while deleting the account.");
        }
    }
}
