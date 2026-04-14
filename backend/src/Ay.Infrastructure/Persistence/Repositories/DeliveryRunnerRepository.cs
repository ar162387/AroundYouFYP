using Ay.Domain.Entities;
using Ay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Ay.Infrastructure.Persistence.Repositories;

public class DeliveryRunnerRepository(AppDbContext context) : IDeliveryRunnerRepository
{
    public async Task<List<DeliveryRunner>> GetByShopIdAsync(Guid shopId)
        => await context.DeliveryRunners.Where(r => r.ShopId == shopId).OrderBy(r => r.Name).ToListAsync();

    public async Task<DeliveryRunner?> GetByIdAsync(Guid id)
        => await context.DeliveryRunners.FindAsync(id);

    public async Task<DeliveryRunner> CreateAsync(DeliveryRunner runner)
    {
        context.DeliveryRunners.Add(runner);
        await context.SaveChangesAsync();
        return runner;
    }

    public async Task<DeliveryRunner> UpdateAsync(DeliveryRunner runner)
    {
        context.DeliveryRunners.Update(runner);
        await context.SaveChangesAsync();
        return runner;
    }

    public async Task DeleteAsync(DeliveryRunner runner)
    {
        context.DeliveryRunners.Remove(runner);
        await context.SaveChangesAsync();
    }
}
