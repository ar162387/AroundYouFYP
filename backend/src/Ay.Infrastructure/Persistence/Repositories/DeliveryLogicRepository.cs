using Ay.Domain.Entities;
using Ay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Ay.Infrastructure.Persistence.Repositories;

public class DeliveryLogicRepository(AppDbContext context) : IDeliveryLogicRepository
{
    public async Task<ShopDeliveryLogic?> GetByShopIdAsync(Guid shopId)
        => await context.ShopDeliveryLogics.FirstOrDefaultAsync(d => d.ShopId == shopId);

    public async Task<ShopDeliveryLogic> CreateAsync(ShopDeliveryLogic logic)
    {
        context.ShopDeliveryLogics.Add(logic);
        await context.SaveChangesAsync();
        return logic;
    }

    public async Task<ShopDeliveryLogic> UpdateAsync(ShopDeliveryLogic logic)
    {
        context.ShopDeliveryLogics.Update(logic);
        await context.SaveChangesAsync();
        return logic;
    }
}
