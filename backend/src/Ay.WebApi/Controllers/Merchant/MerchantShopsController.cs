using Ay.Application.Merchant.DTOs;
using Ay.Application.Merchant.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ay.WebApi.Controllers.Merchant;

[ApiController]
[Route("api/v1/merchant")]
[Authorize(Roles = "merchant")]
public class MerchantShopsController(IShopService shopService) : ControllerBase
{
    [HttpGet("shops")]
    public async Task<IActionResult> GetShops()
    {
        var result = await shopService.GetByMerchantAsync(MerchantHttp.GetUserId(User));
        return result.IsSuccess ? Ok(result.Value) : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }

    [HttpGet("shops/{shopId:guid}")]
    public async Task<IActionResult> GetShop(Guid shopId)
    {
        var result = await shopService.GetByIdAsync(shopId, MerchantHttp.GetUserId(User));
        return result.IsSuccess ? Ok(result.Value) : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }

    [HttpPost("shops")]
    public async Task<IActionResult> CreateShop(CreateShopRequest request)
    {
        var result = await shopService.CreateAsync(MerchantHttp.GetUserId(User), request);
        return result.IsSuccess ? Ok(result.Value) : UnprocessableEntity(MerchantHttp.ToProblem(result.Error!, 422));
    }

    [HttpPut("shops/{shopId:guid}")]
    public async Task<IActionResult> UpdateShop(Guid shopId, UpdateShopRequest request)
    {
        var result = await shopService.UpdateAsync(shopId, MerchantHttp.GetUserId(User), request);
        return result.IsSuccess ? Ok(result.Value) : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }

    [HttpDelete("shops/{shopId:guid}")]
    public async Task<IActionResult> DeleteShop(Guid shopId)
    {
        var result = await shopService.DeleteAsync(shopId, MerchantHttp.GetUserId(User));
        return result.IsSuccess ? NoContent() : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }
}
