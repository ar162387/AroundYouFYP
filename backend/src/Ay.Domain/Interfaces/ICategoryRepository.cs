using Ay.Domain.Entities;

namespace Ay.Domain.Interfaces;

public interface ICategoryRepository
{
    Task<List<MerchantCategory>> GetByShopIdAsync(Guid shopId);
    Task<MerchantCategory?> GetByIdAsync(Guid id);
    Task<MerchantCategory> CreateAsync(MerchantCategory category);
    Task<MerchantCategory> UpdateAsync(MerchantCategory category);
    Task DeleteAsync(MerchantCategory category);
    Task<List<CategoryTemplate>> GetTemplatesAsync();
}
