using System.Text.Json;
using Ay.Application.Merchant.DTOs;
using Ay.Application.Merchant.Services;
using Ay.Domain.Entities;
using Ay.Domain.Interfaces;

namespace Ay.Infrastructure.Services;

public class MerchantItemAuditService(IAuditLogRepository auditLogRepository) : IMerchantItemAuditService
{
    private static JsonDocument ActorDocument(Guid userId) =>
        JsonSerializer.SerializeToDocument(new { id = userId.ToString(), role = "merchant" });

    private static string ResolveUpdateActionType(IReadOnlyDictionary<string, object?> changes)
    {
        if (changes.ContainsKey("price_cents")) return "price_updated";
        if (changes.ContainsKey("is_active")) return "item_deactivated";
        return "name_updated";
    }

    public Task LogItemCreatedAsync(Guid shopId, Guid itemId, Guid userId, string name, int priceCents)
    {
        var log = new AuditLog
        {
            Id = Guid.NewGuid(),
            ShopId = shopId,
            MerchantItemId = itemId,
            Actor = ActorDocument(userId),
            ActionType = "item_created",
            ChangedFields = JsonSerializer.SerializeToDocument(new { name, price_cents = priceCents }),
            Source = "manual",
        };
        return auditLogRepository.LogAsync(log);
    }

    public Task LogItemFieldChangesAsync(Guid shopId, Guid itemId, Guid userId, IReadOnlyDictionary<string, object?> changes)
    {
        if (changes.Count == 0)
            return Task.CompletedTask;

        var dict = changes is Dictionary<string, object?> d ? d : new Dictionary<string, object?>(changes);
        var log = new AuditLog
        {
            Id = Guid.NewGuid(),
            ShopId = shopId,
            MerchantItemId = itemId,
            Actor = ActorDocument(userId),
            ActionType = ResolveUpdateActionType(changes),
            ChangedFields = JsonSerializer.SerializeToDocument(dict),
            Source = "manual",
        };
        return auditLogRepository.LogAsync(log);
    }

    public Task LogItemImageUpdatedAsync(Guid shopId, Guid itemId, Guid userId, string? previousUrl, string newUrl)
    {
        var log = new AuditLog
        {
            Id = Guid.NewGuid(),
            ShopId = shopId,
            MerchantItemId = itemId,
            Actor = ActorDocument(userId),
            ActionType = "image_updated",
            ChangedFields = JsonSerializer.SerializeToDocument(new { from = previousUrl, to = newUrl }),
            Source = "manual",
        };
        return auditLogRepository.LogAsync(log);
    }

    public Task LogItemDeletedAsync(Guid shopId, Guid itemId, Guid userId, string name, int priceCents)
    {
        var log = new AuditLog
        {
            Id = Guid.NewGuid(),
            ShopId = shopId,
            MerchantItemId = itemId,
            Actor = ActorDocument(userId),
            ActionType = "item_deleted",
            ChangedFields = JsonSerializer.SerializeToDocument(new { name, price_cents = priceCents }),
            Source = "manual",
        };
        return auditLogRepository.LogAsync(log);
    }

    public async Task<IReadOnlyList<MerchantItemAuditLogEntryDto>> ListEntriesForShopAsync(Guid shopId, int limit, Guid? merchantItemId = null)
    {
        var rows = await auditLogRepository.ListByShopAsync(shopId, limit, merchantItemId);
        return rows.ConvertAll(log => new MerchantItemAuditLogEntryDto(
            log.Id,
            log.ShopId,
            log.MerchantItemId,
            log.ActionType,
            log.ChangedFields.RootElement.Clone(),
            log.Actor.RootElement.Clone(),
            log.Source,
            log.CreatedAt));
    }
}
