using Ay.Application.Consumer.DTOs;
using Ay.Application.Consumer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ay.WebApi.Controllers.Consumer;

[ApiController]
[Route("api/v1/consumer/orders")]
[Authorize(Roles = "consumer,merchant,admin")]
public class ConsumerOrdersController(IConsumerOrderService orderService) : ControllerBase
{
    [HttpPost("calculate")]
    public async Task<IActionResult> Calculate(CalculateOrderRequest request)
    {
        var result = await orderService.CalculateAsync(ConsumerHttp.GetUserId(User), request);
        return result.IsSuccess ? Ok(result.Value) : UnprocessableEntity(ConsumerHttp.ToProblem(result.Error!, 422));
    }

    [HttpPost]
    public async Task<IActionResult> PlaceOrder(PlaceOrderRequest request)
    {
        var result = await orderService.PlaceOrderAsync(ConsumerHttp.GetUserId(User), request);
        return result.IsSuccess ? Ok(result.Value) : UnprocessableEntity(ConsumerHttp.ToProblem(result.Error!, 422));
    }

    [HttpGet]
    public async Task<IActionResult> GetOrders()
    {
        var result = await orderService.GetUserOrdersAsync(ConsumerHttp.GetUserId(User));
        return result.IsSuccess ? Ok(result.Value) : NotFound(ConsumerHttp.ToProblem(result.Error!, 404));
    }

    [HttpGet("active")]
    public async Task<IActionResult> GetActiveOrder()
    {
        var result = await orderService.GetActiveOrderAsync(ConsumerHttp.GetUserId(User));
        return result.IsSuccess ? Ok(result.Value) : NotFound(ConsumerHttp.ToProblem(result.Error!, 404));
    }

    [HttpGet("{orderId:guid}")]
    public async Task<IActionResult> GetOrder(Guid orderId)
    {
        var result = await orderService.GetOrderByIdAsync(orderId, ConsumerHttp.GetUserId(User));
        return result.IsSuccess ? Ok(result.Value) : NotFound(ConsumerHttp.ToProblem(result.Error!, 404));
    }

    [HttpPost("{orderId:guid}/cancel")]
    public async Task<IActionResult> CancelOrder(Guid orderId, ConsumerCancelOrderRequest? request)
    {
        var result = await orderService.CancelOrderAsync(orderId, ConsumerHttp.GetUserId(User), request?.Reason);
        return result.IsSuccess ? NoContent() : UnprocessableEntity(ConsumerHttp.ToProblem(result.Error!, 422));
    }
}
