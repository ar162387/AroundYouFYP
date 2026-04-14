using Ay.Domain.Entities;
using Ay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Ay.Infrastructure.Persistence.Repositories;

public class OrderRepository(AppDbContext context) : IOrderRepository
{
    public async Task<List<Order>> GetByShopIdAsync(Guid shopId, string? statusFilter = null, DateTimeOffset? from = null, DateTimeOffset? to = null)
    {
        var query = context.Orders
            .Where(o => o.ShopId == shopId)
            .Include(o => o.OrderItems)
            .Include(o => o.DeliveryRunner)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(statusFilter))
            query = query.Where(o => o.Status == statusFilter);
        if (from.HasValue)
            query = query.Where(o => o.PlacedAt >= from.Value);
        if (to.HasValue)
            query = query.Where(o => o.PlacedAt <= to.Value);

        return await query.OrderByDescending(o => o.PlacedAt).ToListAsync();
    }

    public async Task<Order?> GetByIdAsync(Guid id)
        => await context.Orders.FindAsync(id);

    public async Task<Order?> GetByIdWithDetailsAsync(Guid id)
        => await context.Orders
            .Include(o => o.OrderItems)
            .Include(o => o.DeliveryRunner)
            .FirstOrDefaultAsync(o => o.Id == id);

    public async Task<Order> UpdateAsync(Order order)
    {
        context.Orders.Update(order);
        await context.SaveChangesAsync();
        return order;
    }

    public async Task<string> GenerateOrderNumberAsync()
    {
        var seq = await context.Database
            .SqlQuery<long>($"SELECT nextval('order_number_seq') AS \"Value\"")
            .FirstAsync();
        return $"AY-{seq:D6}";
    }
}
