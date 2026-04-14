using Ay.Application.Merchant.DTOs;
using Ay.Domain.Common;

namespace Ay.Application.Merchant.Services;

public interface IMerchantOrderService
{
    Task<Result<List<MerchantOrderDto>>> GetShopOrdersAsync(Guid shopId, Guid userId, string? statusFilter = null);
    Task<Result<MerchantOrderDto>> GetOrderByIdAsync(Guid shopId, Guid orderId, Guid userId);
    Task<Result> ConfirmOrderAsync(Guid shopId, Guid orderId, Guid userId);
    Task<Result> DispatchOrderAsync(Guid shopId, Guid orderId, Guid userId, Guid runnerId);
    Task<Result> MarkDeliveredAsync(Guid shopId, Guid orderId, Guid userId);
    Task<Result> CancelOrderAsync(Guid shopId, Guid orderId, Guid userId, string reason);
    Task<Result<OrderAnalyticsDto>> GetAnalyticsAsync(Guid shopId, Guid userId);
}
