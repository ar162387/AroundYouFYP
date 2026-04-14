using Ay.Domain.Entities;

namespace Ay.Domain.Interfaces;

public interface IReviewRepository
{
    Task<Review> CreateAsync(Review review);
    Task<List<Review>> GetByShopIdAsync(Guid shopId, int page, int pageSize);
    Task<bool> ExistsAsync(Guid userId, Guid shopId);
    Task<(decimal averageRating, int count)> GetShopRatingAsync(Guid shopId);
}
