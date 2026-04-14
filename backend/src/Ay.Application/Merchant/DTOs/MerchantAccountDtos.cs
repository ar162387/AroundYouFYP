using Ay.Application.Auth.DTOs;

namespace Ay.Application.Merchant.DTOs;

public record CreateMerchantAccountRequest(string ShopType, string NumberOfShops, string? NameAsPerCnic = null, string? Cnic = null, DateOnly? CnicExpiry = null);
/// <param name="Status">Merchants may only set <c>pending</c> when submitting identity (with CNIC fields). <c>verified</c> is admin-only.</param>
public record UpdateMerchantAccountRequest(string? ShopType = null, string? NumberOfShops = null, string? NameAsPerCnic = null, string? Cnic = null, DateOnly? CnicExpiry = null, string? Status = null);
public record MerchantAccountDto(Guid Id, Guid UserId, string ShopType, string NumberOfShops, string Status, string? NameAsPerCnic, string? Cnic, DateOnly? CnicExpiry, DateTimeOffset CreatedAt);

/// <summary>Returned when a consumer becomes a merchant so the client can replace JWT claims (role).</summary>
public record MerchantAccountCreatedResponse(MerchantAccountDto Merchant, string AccessToken, DateTimeOffset ExpiresAt, UserDto User);
