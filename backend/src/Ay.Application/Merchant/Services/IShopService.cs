using Ay.Application.Merchant.DTOs;
using Ay.Domain.Common;

namespace Ay.Application.Merchant.Services;

public interface IShopService
{
    Task<Result<List<ShopDto>>> GetByMerchantAsync(Guid userId);
    Task<Result<ShopDto>> GetByIdAsync(Guid shopId, Guid userId);
    Task<Result<ShopDto>> CreateAsync(Guid userId, CreateShopRequest request);
    Task<Result<ShopDto>> UpdateAsync(Guid shopId, Guid userId, UpdateShopRequest request);
    Task<Result> UpdateImageAsync(Guid shopId, Guid userId, string imageUrl);
    Task<Result> DeleteAsync(Guid shopId, Guid userId);
}
