using Ay.Application.Merchant.DTOs;
using Ay.Domain.Common;

namespace Ay.Application.Merchant.Services;

public interface IDeliveryAreaService
{
    Task<Result<List<DeliveryAreaDto>>> GetAreasAsync(Guid shopId, Guid userId);
    Task<Result<DeliveryAreaDto>> CreateAreaAsync(Guid shopId, Guid userId, CreateDeliveryAreaRequest request);
    Task<Result> DeleteAreaAsync(Guid shopId, Guid areaId, Guid userId);
}
