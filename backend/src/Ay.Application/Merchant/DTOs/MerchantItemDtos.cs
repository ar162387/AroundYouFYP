using System.Text.Json;

namespace Ay.Application.Merchant.DTOs;

public record CreateItemRequest(string Name, string? Description = null, int PriceCents = 0, Guid? TemplateId = null, Guid[]? CategoryIds = null, string? Barcode = null, string? Sku = null, string? ImageUrl = null, bool IsActive = true);
public record UpdateItemRequest(string? Name = null, string? Description = null, int? PriceCents = null, Guid[]? CategoryIds = null, string? Barcode = null, string? Sku = null, string? ImageUrl = null, bool? IsActive = null);
public record MerchantItemDto(Guid Id, Guid ShopId, string? Name, string? Description, int PriceCents, string Currency, string? ImageUrl, string? Barcode, string? Sku, bool IsActive, bool IsCustom, int TimesSold, long TotalRevenueCents, CategorySummaryDto[] Categories, Guid? TemplateId, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
public record ItemTemplateDto(Guid Id, string Name, string? Barcode, string? Description, string? ImageUrl, string? DefaultUnit);

public record MerchantItemAuditLogEntryDto(
    Guid Id,
    Guid ShopId,
    Guid? MerchantItemId,
    string ActionType,
    JsonElement ChangedFields,
    JsonElement Actor,
    string Source,
    DateTimeOffset CreatedAt);

public record MerchantItemAuditLogResponseDto(IReadOnlyList<MerchantItemAuditLogEntryDto> Entries, string? NextCursor);
