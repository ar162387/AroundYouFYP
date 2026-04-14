using Ay.Application.Consumer.DTOs;
using Ay.Application.Consumer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ay.WebApi.Controllers.Merchant;

[ApiController]
[Route("api/v1/merchant/notification-preferences")]
[Authorize(Roles = "merchant")]
public class MerchantNotificationsController(INotificationPreferenceService prefService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var result = await prefService.GetAsync(MerchantHttp.GetUserId(User), "merchant");
        return result.IsSuccess ? Ok(result.Value) : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }

    [HttpPut]
    public async Task<IActionResult> Update(UpdateNotificationPreferenceRequest request)
    {
        var result = await prefService.UpsertAsync(MerchantHttp.GetUserId(User), "merchant", request);
        return result.IsSuccess ? Ok(result.Value) : UnprocessableEntity(MerchantHttp.ToProblem(result.Error!, 422));
    }
}
