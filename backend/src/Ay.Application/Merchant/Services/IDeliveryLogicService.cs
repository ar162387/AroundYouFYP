using Ay.Application.Merchant.DTOs;
using Ay.Domain.Common;

namespace Ay.Application.Merchant.Services;

public interface IDeliveryLogicService
{
    Task<Result<DeliveryLogicDto>> GetByShopIdAsync(Guid shopId, Guid userId);
    Task<Result<DeliveryLogicDto>> UpsertAsync(Guid shopId, Guid userId, UpdateDeliveryLogicRequest request);
}
