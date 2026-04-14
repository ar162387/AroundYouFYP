namespace Ay.Domain.Entities;

public class MerchantItemCategory
{
    public Guid MerchantItemId { get; set; }
    public Guid MerchantCategoryId { get; set; }
    public int SortOrder { get; set; }
    public MerchantItem? MerchantItem { get; set; }
    public MerchantCategory? MerchantCategory { get; set; }
}
