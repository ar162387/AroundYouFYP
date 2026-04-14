using Ay.Domain.Entities;

namespace Ay.Domain.Interfaces;

public interface IDeliveryRunnerRepository
{
    Task<List<DeliveryRunner>> GetByShopIdAsync(Guid shopId);
    Task<DeliveryRunner?> GetByIdAsync(Guid id);
    Task<DeliveryRunner> CreateAsync(DeliveryRunner runner);
    Task<DeliveryRunner> UpdateAsync(DeliveryRunner runner);
    Task DeleteAsync(DeliveryRunner runner);
}
