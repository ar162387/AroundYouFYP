using System.Text.Json;

namespace Ay.Domain.Entities;

public class AuditLog
{
    public Guid Id { get; set; }
    public Guid ShopId { get; set; }
    public Guid? MerchantItemId { get; set; }
    public JsonDocument Actor { get; set; } = null!;
    public string ActionType { get; set; } = string.Empty;
    public JsonDocument ChangedFields { get; set; } = null!;
    public string Source { get; set; } = "manual";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
