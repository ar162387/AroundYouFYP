using Ay.Application.Consumer.DTOs;
using Ay.Domain.Common;

namespace Ay.Application.Consumer.Services;

public interface IReviewService
{
    Task<Result<ReviewDto>> CreateReviewAsync(Guid userId, CreateReviewRequest request);
    Task<Result<List<ReviewDto>>> GetShopReviewsAsync(Guid shopId, int page = 1, int pageSize = 20);
}
