using Ay.Application.Merchant.DTOs;
using Ay.Domain.Common;

namespace Ay.Application.Merchant.Services;

public interface IDeliveryRunnerService
{
    Task<Result<List<DeliveryRunnerWithStatusDto>>> GetByShopIdAsync(Guid shopId, Guid userId);
    Task<Result<DeliveryRunnerDto>> CreateAsync(Guid shopId, Guid userId, CreateRunnerRequest request);
    Task<Result<DeliveryRunnerDto>> UpdateAsync(Guid shopId, Guid runnerId, Guid userId, UpdateRunnerRequest request);
    Task<Result> DeleteAsync(Guid shopId, Guid runnerId, Guid userId);
}
