using Ay.Domain.Entities;

namespace Ay.Domain.Interfaces;

public interface IDeliveryLogicRepository
{
    Task<ShopDeliveryLogic?> GetByShopIdAsync(Guid shopId);
    Task<ShopDeliveryLogic> CreateAsync(ShopDeliveryLogic logic);
    Task<ShopDeliveryLogic> UpdateAsync(ShopDeliveryLogic logic);
}
