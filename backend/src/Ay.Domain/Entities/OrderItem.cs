namespace Ay.Domain.Entities;

public class OrderItem
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid? MerchantItemId { get; set; }
    public string ItemName { get; set; } = string.Empty;
    public string? ItemDescription { get; set; }
    public string? ItemImageUrl { get; set; }
    public int ItemPriceCents { get; set; }
    public int Quantity { get; set; }
    public int SubtotalCents { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Order? Order { get; set; }
    public MerchantItem? MerchantItem { get; set; }
}
