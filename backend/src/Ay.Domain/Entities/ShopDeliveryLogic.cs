using System.Text.Json;

namespace Ay.Domain.Entities;

public class ShopDeliveryLogic
{
    public Guid Id { get; set; }
    public Guid ShopId { get; set; }
    public decimal MinimumOrderValue { get; set; } = 200;
    public decimal SmallOrderSurcharge { get; set; } = 40;
    public decimal LeastOrderValue { get; set; } = 100;
    public string DistanceMode { get; set; } = "auto";
    public decimal MaxDeliveryFee { get; set; } = 130;
    public JsonDocument? DistanceTiers { get; set; }
    public decimal BeyondTierFeePerUnit { get; set; } = 10;
    public decimal BeyondTierDistanceUnit { get; set; } = 250;
    public decimal FreeDeliveryThreshold { get; set; } = 800;
    public decimal FreeDeliveryRadius { get; set; } = 1000;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Shop? Shop { get; set; }
}
