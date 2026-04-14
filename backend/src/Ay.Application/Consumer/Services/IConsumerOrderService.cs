using Ay.Application.Consumer.DTOs;
using Ay.Domain.Common;

namespace Ay.Application.Consumer.Services;

public interface IConsumerOrderService
{
    Task<Result<OrderCalculationDto>> CalculateAsync(Guid userId, CalculateOrderRequest request);
    Task<Result<ConsumerOrderDto>> PlaceOrderAsync(Guid userId, PlaceOrderRequest request);
    Task<Result<List<ConsumerOrderDto>>> GetUserOrdersAsync(Guid userId);
    Task<Result<ConsumerOrderDto>> GetOrderByIdAsync(Guid orderId, Guid userId);
    Task<Result<ConsumerOrderDto?>> GetActiveOrderAsync(Guid userId);
    Task<Result> CancelOrderAsync(Guid orderId, Guid userId, string? reason);
}
