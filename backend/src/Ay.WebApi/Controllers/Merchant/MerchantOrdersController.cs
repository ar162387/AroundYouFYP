using Ay.Application.Merchant.DTOs;
using Ay.Application.Merchant.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ay.WebApi.Controllers.Merchant;

[ApiController]
[Route("api/v1/merchant")]
[Authorize(Roles = "merchant")]
public class MerchantOrdersController(IMerchantOrderService orderService) : ControllerBase
{
    [HttpGet("shops/{shopId:guid}/orders")]
    public async Task<IActionResult> GetOrders(Guid shopId, [FromQuery] string? status)
    {
        var result = await orderService.GetShopOrdersAsync(shopId, MerchantHttp.GetUserId(User), status);
        return result.IsSuccess ? Ok(result.Value) : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }

    [HttpGet("shops/{shopId:guid}/orders/{orderId:guid}")]
    public async Task<IActionResult> GetOrder(Guid shopId, Guid orderId)
    {
        var result = await orderService.GetOrderByIdAsync(shopId, orderId, MerchantHttp.GetUserId(User));
        return result.IsSuccess ? Ok(result.Value) : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }

    [HttpPost("shops/{shopId:guid}/orders/{orderId:guid}/confirm")]
    public async Task<IActionResult> ConfirmOrder(Guid shopId, Guid orderId)
    {
        var result = await orderService.ConfirmOrderAsync(shopId, orderId, MerchantHttp.GetUserId(User));
        return result.IsSuccess ? NoContent() : UnprocessableEntity(MerchantHttp.ToProblem(result.Error!, 422));
    }

    [HttpPost("shops/{shopId:guid}/orders/{orderId:guid}/dispatch")]
    public async Task<IActionResult> DispatchOrder(Guid shopId, Guid orderId, DispatchOrderRequest request)
    {
        var result = await orderService.DispatchOrderAsync(shopId, orderId, MerchantHttp.GetUserId(User), request.RunnerId);
        return result.IsSuccess ? NoContent() : UnprocessableEntity(MerchantHttp.ToProblem(result.Error!, 422));
    }

    [HttpPost("shops/{shopId:guid}/orders/{orderId:guid}/deliver")]
    public async Task<IActionResult> DeliverOrder(Guid shopId, Guid orderId)
    {
        var result = await orderService.MarkDeliveredAsync(shopId, orderId, MerchantHttp.GetUserId(User));
        return result.IsSuccess ? NoContent() : UnprocessableEntity(MerchantHttp.ToProblem(result.Error!, 422));
    }

    [HttpPost("shops/{shopId:guid}/orders/{orderId:guid}/cancel")]
    public async Task<IActionResult> CancelOrder(Guid shopId, Guid orderId, CancelOrderRequest request)
    {
        var result = await orderService.CancelOrderAsync(shopId, orderId, MerchantHttp.GetUserId(User), request.Reason);
        return result.IsSuccess ? NoContent() : UnprocessableEntity(MerchantHttp.ToProblem(result.Error!, 422));
    }

    [HttpGet("shops/{shopId:guid}/analytics")]
    public async Task<IActionResult> GetAnalytics(Guid shopId)
    {
        var result = await orderService.GetAnalyticsAsync(shopId, MerchantHttp.GetUserId(User));
        return result.IsSuccess ? Ok(result.Value) : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }
}
