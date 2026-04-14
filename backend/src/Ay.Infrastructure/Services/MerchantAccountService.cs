using Ay.Application.Auth.DTOs;
using Ay.Application.Auth.Services;
using Ay.Application.Merchant.DTOs;
using Ay.Application.Merchant.Services;
using Ay.Domain.Common;
using Ay.Domain.Entities;
using Ay.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace Ay.Infrastructure.Services;

public class MerchantAccountService(
    IMerchantAccountRepository merchantRepo,
    IUserProfileRepository profileRepo,
    IJwtTokenGenerator jwtGenerator,
    ILogger<MerchantAccountService> logger) : IMerchantAccountService
{
    public async Task<Result<MerchantAccountDto>> GetByUserIdAsync(Guid userId)
    {
        var account = await merchantRepo.GetByUserIdAsync(userId);
        if (account is null)
            return Result.Failure<MerchantAccountDto>("Merchant account not found.");
        return Result.Success(ToDto(account));
    }

    public async Task<Result<MerchantAccountCreatedResponse>> CreateAsync(Guid userId, CreateMerchantAccountRequest request)
    {
        var existing = await merchantRepo.GetByUserIdAsync(userId);
        if (existing is not null)
            return Result.Failure<MerchantAccountCreatedResponse>("Merchant account already exists.");

        var profile = await profileRepo.GetByUserIdAsync(userId);
        if (profile is null)
            return Result.Failure<MerchantAccountCreatedResponse>("User profile not found.");

        profile.Role = Domain.Enums.UserRole.Merchant;
        profile.UpdatedAt = DateTimeOffset.UtcNow;
        await profileRepo.UpdateAsync(profile);

        var account = new MerchantAccount
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ShopType = request.ShopType,
            NumberOfShops = request.NumberOfShops,
            Status = "none",
            NameAsPerCnic = request.NameAsPerCnic,
            Cnic = request.Cnic,
            CnicExpiry = request.CnicExpiry,
        };

        await merchantRepo.CreateAsync(account);
        logger.LogInformation("Merchant account created for user {UserId}", userId);

        var (accessToken, expiresAt) = jwtGenerator.GenerateToken(
            userId,
            profile.Email ?? string.Empty,
            profile.Name,
            profile.Role.ToString().ToLowerInvariant());

        var userDto = new UserDto(userId, profile.Email ?? string.Empty, profile.Name, profile.Role.ToString().ToLowerInvariant(), profile.CreatedAt);
        var payload = new MerchantAccountCreatedResponse(ToDto(account), accessToken, expiresAt, userDto);
        return Result.Success(payload);
    }

    public async Task<Result<MerchantAccountDto>> UpdateAsync(Guid userId, UpdateMerchantAccountRequest request)
    {
        var account = await merchantRepo.GetByUserIdAsync(userId);
        if (account is null)
            return Result.Failure<MerchantAccountDto>("Merchant account not found.");

        if (request.ShopType is not null) account.ShopType = request.ShopType;
        if (request.NumberOfShops is not null) account.NumberOfShops = request.NumberOfShops;
        if (request.NameAsPerCnic is not null) account.NameAsPerCnic = request.NameAsPerCnic;
        if (request.Cnic is not null) account.Cnic = request.Cnic;
        if (request.CnicExpiry is not null) account.CnicExpiry = request.CnicExpiry;

        if (request.Status is not null)
        {
            var normalized = request.Status.Trim().ToLowerInvariant();
            if (normalized == "verified")
                return Result.Failure<MerchantAccountDto>("Status cannot be set to verified by the merchant.");

            if (normalized == "pending")
            {
                if (account.Status == "verified")
                    return Result.Failure<MerchantAccountDto>("Merchant is already verified.");

                if (string.IsNullOrWhiteSpace(account.NameAsPerCnic)
                    || string.IsNullOrWhiteSpace(account.Cnic)
                    || account.CnicExpiry is null)
                    return Result.Failure<MerchantAccountDto>("Name, CNIC, and CNIC expiry are required to submit verification.");

                account.Status = "pending";
            }
            else if (normalized == "none")
                return Result.Failure<MerchantAccountDto>("Status cannot be set to none through this endpoint.");
            else
                return Result.Failure<MerchantAccountDto>("Invalid status value.");
        }

        account.UpdatedAt = DateTimeOffset.UtcNow;

        await merchantRepo.UpdateAsync(account);
        return Result.Success(ToDto(account));
    }

    public async Task<Result> DeleteAsync(Guid userId)
    {
        var account = await merchantRepo.GetByUserIdAsync(userId);
        if (account is null)
            return Result.Failure("Merchant account not found.");

        await merchantRepo.DeleteAsync(account);

        var profile = await profileRepo.GetByUserIdAsync(userId);
        if (profile is not null)
        {
            profile.Role = Domain.Enums.UserRole.Consumer;
            profile.UpdatedAt = DateTimeOffset.UtcNow;
            await profileRepo.UpdateAsync(profile);
        }

        return Result.Success();
    }

    private static MerchantAccountDto ToDto(MerchantAccount m) => new(
        m.Id, m.UserId, m.ShopType, m.NumberOfShops, m.Status,
        m.NameAsPerCnic, m.Cnic, m.CnicExpiry, m.CreatedAt);
}
