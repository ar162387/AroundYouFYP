using Ay.Application.Consumer.DTOs;
using Ay.Application.Consumer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ay.WebApi.Controllers.Consumer;

[ApiController]
[Route("api/v1/consumer/notification-preferences")]
[Authorize]
public class ConsumerNotificationsController(INotificationPreferenceService prefService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var result = await prefService.GetAsync(ConsumerHttp.GetUserId(User), "consumer");
        return result.IsSuccess ? Ok(result.Value) : NotFound(ConsumerHttp.ToProblem(result.Error!, 404));
    }

    [HttpPut]
    public async Task<IActionResult> Update(UpdateNotificationPreferenceRequest request)
    {
        var result = await prefService.UpsertAsync(ConsumerHttp.GetUserId(User), "consumer", request);
        return result.IsSuccess ? Ok(result.Value) : UnprocessableEntity(ConsumerHttp.ToProblem(result.Error!, 422));
    }
}
