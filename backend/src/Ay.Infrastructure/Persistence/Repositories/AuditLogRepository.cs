using Ay.Domain.Entities;
using Ay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Ay.Infrastructure.Persistence.Repositories;

public class AuditLogRepository(AppDbContext context) : IAuditLogRepository
{
    public async Task LogAsync(AuditLog log)
    {
        context.AuditLogs.Add(log);
        await context.SaveChangesAsync();
    }

    public async Task<List<AuditLog>> ListByShopAsync(Guid shopId, int take, Guid? merchantItemId = null)
    {
        take = Math.Clamp(take, 1, 200);
        var query = context.AuditLogs.AsNoTracking().Where(a => a.ShopId == shopId);
        if (merchantItemId is Guid itemId)
            query = query.Where(a => a.MerchantItemId == itemId);

        return await query
            .OrderByDescending(a => a.CreatedAt)
            .ThenByDescending(a => a.Id)
            .Take(take)
            .ToListAsync();
    }
}
