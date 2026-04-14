using Ay.Application.Consumer.DTOs;
using Ay.Application.Consumer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ay.WebApi.Controllers.Consumer;

[ApiController]
[Route("api/v1/consumer/reviews")]
[Authorize(Roles = "consumer,merchant,admin")]
public class ConsumerReviewsController(IReviewService reviewService) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> CreateReview(CreateReviewRequest request)
    {
        var result = await reviewService.CreateReviewAsync(ConsumerHttp.GetUserId(User), request);
        return result.IsSuccess ? Ok(result.Value) : UnprocessableEntity(ConsumerHttp.ToProblem(result.Error!, 422));
    }
}
