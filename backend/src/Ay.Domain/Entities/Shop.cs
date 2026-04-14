using System.Text.Json;

namespace Ay.Domain.Entities;

public class Shop
{
    public Guid Id { get; set; }
    public Guid MerchantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ShopType { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string? ImageUrl { get; set; }
    public string[] Tags { get; set; } = [];
    public bool IsOpen { get; set; } = true;
    public JsonDocument? OpeningHours { get; set; }
    public JsonDocument? Holidays { get; set; }
    public string OpenStatusMode { get; set; } = "auto";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public MerchantAccount? MerchantAccount { get; set; }
    public ShopDeliveryLogic? DeliveryLogic { get; set; }
    public List<MerchantCategory> Categories { get; set; } = [];
    public List<MerchantItem> Items { get; set; } = [];
    public List<DeliveryRunner> Runners { get; set; } = [];
    public List<ShopDeliveryArea> DeliveryAreas { get; set; } = [];
}
