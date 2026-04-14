using Ay.Domain.Entities;
using Ay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Ay.Infrastructure.Persistence.Repositories;

public class ReviewRepository(AppDbContext context) : IReviewRepository
{
    public async Task<Review> CreateAsync(Review review)
    {
        context.Reviews.Add(review);
        await context.SaveChangesAsync();
        return review;
    }

    public async Task<List<Review>> GetByShopIdAsync(Guid shopId, int page, int pageSize)
        => await context.Reviews.Where(r => r.ShopId == shopId)
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync();

    public async Task<bool> ExistsAsync(Guid userId, Guid shopId)
        => await context.Reviews.AnyAsync(r => r.UserId == userId && r.ShopId == shopId);

    public async Task<(decimal averageRating, int count)> GetShopRatingAsync(Guid shopId)
    {
        var reviews = await context.Reviews.Where(r => r.ShopId == shopId).ToListAsync();
        if (reviews.Count == 0) return (0, 0);
        return ((decimal)reviews.Average(r => r.Rating), reviews.Count);
    }
}
