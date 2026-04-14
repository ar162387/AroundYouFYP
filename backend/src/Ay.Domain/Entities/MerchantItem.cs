using System.Text.Json;

namespace Ay.Domain.Entities;

public class MerchantItem
{
    public Guid Id { get; set; }
    public Guid ShopId { get; set; }
    public Guid? TemplateId { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Barcode { get; set; }
    public string? ImageUrl { get; set; }
    public string? Sku { get; set; }
    public int PriceCents { get; set; }
    public string Currency { get; set; } = "PKR";
    public bool IsActive { get; set; } = true;
    public bool IsCustom { get; set; } = true;
    public Guid? CreatedBy { get; set; }
    public JsonDocument? LastUpdatedBy { get; set; }
    public int TimesSold { get; set; }
    public long TotalRevenueCents { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Shop? Shop { get; set; }
    public ItemTemplate? Template { get; set; }
    public List<MerchantItemCategory> ItemCategories { get; set; } = [];
}
