using Ay.Domain.Entities;

namespace Ay.Domain.Interfaces;

public interface IItemRepository
{
    Task<List<MerchantItem>> GetByShopIdAsync(Guid shopId);
    Task<MerchantItem?> GetByIdAsync(Guid id);
    Task<MerchantItem?> GetByIdWithCategoriesAsync(Guid id);
    Task<MerchantItem> CreateAsync(MerchantItem item);
    Task<MerchantItem> UpdateAsync(MerchantItem item);
    Task DeleteAsync(MerchantItem item);
    Task<List<ItemTemplate>> SearchTemplatesAsync(string? search);
    Task SetItemCategoriesAsync(Guid itemId, Guid[] categoryIds);
}
