using Ay.Application.Merchant.DTOs;
using Ay.Application.Merchant.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ay.WebApi.Controllers.Merchant;

[ApiController]
[Route("api/v1/merchant")]
[Authorize(Roles = "merchant")]
public class MerchantDeliveryLogicController(IDeliveryLogicService deliveryLogicService) : ControllerBase
{
    [HttpGet("shops/{shopId:guid}/delivery-logic")]
    public async Task<IActionResult> GetDeliveryLogic(Guid shopId)
    {
        var result = await deliveryLogicService.GetByShopIdAsync(shopId, MerchantHttp.GetUserId(User));
        return result.IsSuccess ? Ok(result.Value) : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }

    [HttpPut("shops/{shopId:guid}/delivery-logic")]
    public async Task<IActionResult> UpdateDeliveryLogic(Guid shopId, UpdateDeliveryLogicRequest request)
    {
        var result = await deliveryLogicService.UpsertAsync(shopId, MerchantHttp.GetUserId(User), request);
        return result.IsSuccess ? Ok(result.Value) : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }
}
