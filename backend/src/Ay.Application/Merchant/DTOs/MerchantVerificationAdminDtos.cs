namespace Ay.Application.Merchant.DTOs;

/// <summary>One row for an internal dashboard listing merchant-submitted identity details.</summary>
public record MerchantVerificationIdentityDto(
    Guid MerchantId,
    Guid UserId,
    string? Email,
    string? AccountName,
    string Status,
    string? NameAsPerCnic,
    string? Cnic,
    DateOnly? CnicExpiry,
    DateTimeOffset LastUpdatedAt);
