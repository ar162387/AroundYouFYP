namespace Ay.Domain.Entities;

public class MerchantCategory
{
    public Guid Id { get; set; }
    public Guid ShopId { get; set; }
    public Guid? TemplateId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsCustom { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Shop? Shop { get; set; }
    public CategoryTemplate? Template { get; set; }
    public List<MerchantItemCategory> ItemCategories { get; set; } = [];
}
