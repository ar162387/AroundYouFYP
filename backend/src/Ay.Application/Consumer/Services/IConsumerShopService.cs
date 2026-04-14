using Ay.Application.Consumer.DTOs;
using Ay.Domain.Common;

namespace Ay.Application.Consumer.Services;

public interface IConsumerShopService
{
    Task<Result<List<ConsumerShopDto>>> FindByLocationAsync(double latitude, double longitude, double radiusMeters = 5000, string? shopType = null, int page = 1, int pageSize = 20);
    Task<Result<ShopDetailDto>> GetShopDetailAsync(Guid shopId, double? consumerLat, double? consumerLon);
}
