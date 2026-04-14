namespace Ay.Domain.Entities;

public class MerchantAccount
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string ShopType { get; set; } = string.Empty;
    public string NumberOfShops { get; set; } = string.Empty;
    public string Status { get; set; } = "none";
    public string? NameAsPerCnic { get; set; }
    public string? Cnic { get; set; }
    public DateOnly? CnicExpiry { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public List<Shop> Shops { get; set; } = [];
}
