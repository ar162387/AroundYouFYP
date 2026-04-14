using Ay.Application.Merchant.DTOs;
using Ay.Application.Merchant.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ay.WebApi.Controllers.Merchant;

[ApiController]
[Route("api/v1/merchant/shops/{shopId:guid}/delivery-areas")]
[Authorize(Roles = "merchant")]
public class MerchantDeliveryAreasController(IDeliveryAreaService deliveryAreaService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAreas(Guid shopId)
    {
        var result = await deliveryAreaService.GetAreasAsync(shopId, MerchantHttp.GetUserId(User));
        return result.IsSuccess ? Ok(result.Value) : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }

    [HttpPost]
    public async Task<IActionResult> CreateArea(Guid shopId, CreateDeliveryAreaRequest request)
    {
        var result = await deliveryAreaService.CreateAreaAsync(shopId, MerchantHttp.GetUserId(User), request);
        return result.IsSuccess
            ? CreatedAtAction(nameof(GetAreas), new { shopId }, result.Value)
            : UnprocessableEntity(MerchantHttp.ToProblem(result.Error!, 422));
    }

    [HttpDelete("{areaId:guid}")]
    public async Task<IActionResult> DeleteArea(Guid shopId, Guid areaId)
    {
        var result = await deliveryAreaService.DeleteAreaAsync(shopId, areaId, MerchantHttp.GetUserId(User));
        return result.IsSuccess ? NoContent() : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }
}
