using Ay.Domain.Entities;

namespace Ay.Domain.Interfaces;

public interface IOrderRepository
{
    Task<List<Order>> GetByShopIdAsync(Guid shopId, string? statusFilter = null, DateTimeOffset? from = null, DateTimeOffset? to = null);
    Task<Order?> GetByIdAsync(Guid id);
    Task<Order?> GetByIdWithDetailsAsync(Guid id);
    Task<Order> UpdateAsync(Order order);
    Task<string> GenerateOrderNumberAsync();
}
