using Ay.Application.Merchant.DTOs;

namespace Ay.Application.Merchant.Services;

/// <summary>
/// Persists and reads audit trail entries for merchant inventory item CRUD.
/// </summary>
public interface IMerchantItemAuditService
{
    Task LogItemCreatedAsync(Guid shopId, Guid itemId, Guid userId, string name, int priceCents);

    Task LogItemFieldChangesAsync(Guid shopId, Guid itemId, Guid userId, IReadOnlyDictionary<string, object?> changes);

    Task LogItemImageUpdatedAsync(Guid shopId, Guid itemId, Guid userId, string? previousUrl, string newUrl);

    Task LogItemDeletedAsync(Guid shopId, Guid itemId, Guid userId, string name, int priceCents);

    Task<IReadOnlyList<MerchantItemAuditLogEntryDto>> ListEntriesForShopAsync(Guid shopId, int limit, Guid? merchantItemId = null);
}
