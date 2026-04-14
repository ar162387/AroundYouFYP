using Ay.Domain.Entities;

namespace Ay.Domain.Interfaces;

public interface IAuditLogRepository
{
    Task LogAsync(AuditLog log);

    Task<List<AuditLog>> ListByShopAsync(Guid shopId, int take, Guid? merchantItemId = null);
}
