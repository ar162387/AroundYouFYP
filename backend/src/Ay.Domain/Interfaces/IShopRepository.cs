using Ay.Domain.Entities;

namespace Ay.Domain.Interfaces;

public interface IShopRepository
{
    Task<List<Shop>> GetByMerchantIdAsync(Guid merchantId);
    Task<Shop?> GetByIdAsync(Guid id);
    Task<Shop?> GetByIdWithDetailsAsync(Guid id);
    Task<Shop> CreateAsync(Shop shop);
    Task<Shop> UpdateAsync(Shop shop);
    Task DeleteAsync(Shop shop);
}
