using Ay.Domain.Entities;
using Ay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Ay.Infrastructure.Persistence.Repositories;

public class ShopRepository(AppDbContext context) : IShopRepository
{
    public async Task<List<Shop>> GetByMerchantIdAsync(Guid merchantId)
        => await context.Shops.Where(s => s.MerchantId == merchantId).OrderByDescending(s => s.CreatedAt).ToListAsync();

    public async Task<Shop?> GetByIdAsync(Guid id)
        => await context.Shops.FindAsync(id);

    public async Task<Shop?> GetByIdWithDetailsAsync(Guid id)
        => await context.Shops
            .Include(s => s.DeliveryLogic)
            .Include(s => s.Runners)
            .FirstOrDefaultAsync(s => s.Id == id);

    public async Task<Shop> CreateAsync(Shop shop)
    {
        context.Shops.Add(shop);
        await context.SaveChangesAsync();
        return shop;
    }

    public async Task<Shop> UpdateAsync(Shop shop)
    {
        context.Shops.Update(shop);
        await context.SaveChangesAsync();
        return shop;
    }

    public async Task DeleteAsync(Shop shop)
    {
        context.Shops.Remove(shop);
        await context.SaveChangesAsync();
    }
}
