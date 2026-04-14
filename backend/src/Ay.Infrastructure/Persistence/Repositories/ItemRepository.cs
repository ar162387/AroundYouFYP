using Ay.Domain.Entities;
using Ay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Ay.Infrastructure.Persistence.Repositories;

public class ItemRepository(AppDbContext context) : IItemRepository
{
    public async Task<List<MerchantItem>> GetByShopIdAsync(Guid shopId)
        => await context.MerchantItems
            .Where(i => i.ShopId == shopId)
            .Include(i => i.ItemCategories).ThenInclude(ic => ic.MerchantCategory)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync();

    public async Task<MerchantItem?> GetByIdAsync(Guid id)
        => await context.MerchantItems.FindAsync(id);

    public async Task<MerchantItem?> GetByIdWithCategoriesAsync(Guid id)
        => await context.MerchantItems
            .Include(i => i.ItemCategories).ThenInclude(ic => ic.MerchantCategory)
            .FirstOrDefaultAsync(i => i.Id == id);

    public async Task<MerchantItem> CreateAsync(MerchantItem item)
    {
        context.MerchantItems.Add(item);
        await context.SaveChangesAsync();
        return item;
    }

    public async Task<MerchantItem> UpdateAsync(MerchantItem item)
    {
        context.MerchantItems.Update(item);
        await context.SaveChangesAsync();
        return item;
    }

    public async Task DeleteAsync(MerchantItem item)
    {
        context.MerchantItems.Remove(item);
        await context.SaveChangesAsync();
    }

    public async Task<List<ItemTemplate>> SearchTemplatesAsync(string? search)
    {
        var query = context.ItemTemplates.AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(t => t.NameNormalized != null && t.NameNormalized.Contains(search.Trim().ToLower()));
        return await query.OrderBy(t => t.Name).ToListAsync();
    }

    public async Task SetItemCategoriesAsync(Guid itemId, Guid[] categoryIds)
    {
        var existing = await context.MerchantItemCategories.Where(ic => ic.MerchantItemId == itemId).ToListAsync();
        context.MerchantItemCategories.RemoveRange(existing);

        var newLinks = categoryIds.Select((cid, idx) => new MerchantItemCategory
        {
            MerchantItemId = itemId,
            MerchantCategoryId = cid,
            SortOrder = idx
        });
        context.MerchantItemCategories.AddRange(newLinks);
        await context.SaveChangesAsync();
    }
}
