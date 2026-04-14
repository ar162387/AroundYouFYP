using Ay.Application.Merchant.DTOs;
using Ay.Application.Merchant.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ay.WebApi.Controllers.Merchant;

[ApiController]
[Route("api/v1/merchant")]
[Authorize(Roles = "merchant")]
public class MerchantDeliveryRunnersController(IDeliveryRunnerService runnerService) : ControllerBase
{
    [HttpGet("shops/{shopId:guid}/runners")]
    public async Task<IActionResult> GetRunners(Guid shopId)
    {
        var result = await runnerService.GetByShopIdAsync(shopId, MerchantHttp.GetUserId(User));
        return result.IsSuccess ? Ok(result.Value) : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }

    [HttpPost("shops/{shopId:guid}/runners")]
    public async Task<IActionResult> CreateRunner(Guid shopId, CreateRunnerRequest request)
    {
        var result = await runnerService.CreateAsync(shopId, MerchantHttp.GetUserId(User), request);
        return result.IsSuccess ? Ok(result.Value) : UnprocessableEntity(MerchantHttp.ToProblem(result.Error!, 422));
    }

    [HttpPut("shops/{shopId:guid}/runners/{runnerId:guid}")]
    public async Task<IActionResult> UpdateRunner(Guid shopId, Guid runnerId, UpdateRunnerRequest request)
    {
        var result = await runnerService.UpdateAsync(shopId, runnerId, MerchantHttp.GetUserId(User), request);
        return result.IsSuccess ? Ok(result.Value) : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }

    [HttpDelete("shops/{shopId:guid}/runners/{runnerId:guid}")]
    public async Task<IActionResult> DeleteRunner(Guid shopId, Guid runnerId)
    {
        var result = await runnerService.DeleteAsync(shopId, runnerId, MerchantHttp.GetUserId(User));
        return result.IsSuccess ? NoContent() : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }
}
