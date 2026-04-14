using Ay.Domain.Entities;
using Ay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Ay.Infrastructure.Persistence.Repositories;

public class CategoryRepository(AppDbContext context) : ICategoryRepository
{
    public async Task<List<MerchantCategory>> GetByShopIdAsync(Guid shopId)
        => await context.MerchantCategories.Where(c => c.ShopId == shopId).OrderBy(c => c.Name).ToListAsync();

    public async Task<MerchantCategory?> GetByIdAsync(Guid id)
        => await context.MerchantCategories.FindAsync(id);

    public async Task<MerchantCategory> CreateAsync(MerchantCategory category)
    {
        context.MerchantCategories.Add(category);
        await context.SaveChangesAsync();
        return category;
    }

    public async Task<MerchantCategory> UpdateAsync(MerchantCategory category)
    {
        context.MerchantCategories.Update(category);
        await context.SaveChangesAsync();
        return category;
    }

    public async Task DeleteAsync(MerchantCategory category)
    {
        context.MerchantCategories.Remove(category);
        await context.SaveChangesAsync();
    }

    public async Task<List<CategoryTemplate>> GetTemplatesAsync()
        => await context.CategoryTemplates.OrderBy(t => t.Name).ToListAsync();
}
