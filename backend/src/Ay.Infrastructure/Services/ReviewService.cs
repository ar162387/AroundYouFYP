using Ay.Application.Consumer.DTOs;
using Ay.Application.Consumer.Services;
using Ay.Domain.Common;
using Ay.Domain.Entities;
using Ay.Domain.Interfaces;

namespace Ay.Infrastructure.Services;

public class ReviewService(IReviewRepository reviewRepo) : IReviewService
{
    public async Task<Result<ReviewDto>> CreateReviewAsync(Guid userId, CreateReviewRequest request)
    {
        var exists = await reviewRepo.ExistsAsync(userId, request.ShopId);
        if (exists) return Result.Failure<ReviewDto>("You have already reviewed this shop.");

        var review = new Review
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ShopId = request.ShopId,
            OrderId = request.OrderId,
            Rating = request.Rating,
            ReviewText = request.ReviewText,
        };
        await reviewRepo.CreateAsync(review);
        return Result.Success(new ReviewDto(review.Id, review.UserId, review.ShopId, review.OrderId, review.Rating, review.ReviewText, review.CreatedAt));
    }

    public async Task<Result<List<ReviewDto>>> GetShopReviewsAsync(Guid shopId, int page = 1, int pageSize = 20)
    {
        var reviews = await reviewRepo.GetByShopIdAsync(shopId, page, pageSize);
        return Result.Success(reviews.Select(r => new ReviewDto(r.Id, r.UserId, r.ShopId, r.OrderId, r.Rating, r.ReviewText, r.CreatedAt)).ToList());
    }
}
