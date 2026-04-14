using Ay.Application.Consumer.DTOs;
using Ay.Application.Consumer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ay.WebApi.Controllers.Consumer;

[ApiController]
[Route("api/v1/consumer")]
[Authorize(Roles = "consumer,merchant,admin")]
public class ConsumerProfileController(IConsumerProfileService profileService) : ControllerBase
{
    [HttpGet("profile")]
    public async Task<IActionResult> GetProfile()
    {
        var result = await profileService.GetProfileAsync(ConsumerHttp.GetUserId(User));
        return result.IsSuccess ? Ok(result.Value) : NotFound(ConsumerHttp.ToProblem(result.Error!, 404));
    }

    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile(UpdateConsumerProfileRequest request)
    {
        var result = await profileService.UpdateProfileAsync(ConsumerHttp.GetUserId(User), request);
        return result.IsSuccess ? Ok(result.Value) : NotFound(ConsumerHttp.ToProblem(result.Error!, 404));
    }
}
