using Ay.Application.Consumer.Services;
using Microsoft.AspNetCore.Mvc;

namespace Ay.WebApi.Controllers.Consumer;

[ApiController]
[Route("api/v1/consumer/shops")]
// Public catalog: browsing must work before sign-in. Add [Authorize] on specific actions if you add mutations.
public class ConsumerShopsController(IConsumerShopService shopService, IReviewService reviewService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> FindShops(
        [FromQuery] double lat, [FromQuery] double lon,
        [FromQuery] double radius = 5000, [FromQuery] string? type = null,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var result = await shopService.FindByLocationAsync(lat, lon, radius, type, page, pageSize);
        return result.IsSuccess ? Ok(result.Value) : NotFound(ConsumerHttp.ToProblem(result.Error!, 404));
    }

    [HttpGet("{shopId:guid}")]
    public async Task<IActionResult> GetShopDetail(Guid shopId, [FromQuery] double? lat, [FromQuery] double? lon)
    {
        var result = await shopService.GetShopDetailAsync(shopId, lat, lon);
        return result.IsSuccess ? Ok(result.Value) : NotFound(ConsumerHttp.ToProblem(result.Error!, 404));
    }

    [HttpGet("{shopId:guid}/reviews")]
    public async Task<IActionResult> GetShopReviews(Guid shopId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var result = await reviewService.GetShopReviewsAsync(shopId, page, pageSize);
        return result.IsSuccess ? Ok(result.Value) : NotFound(ConsumerHttp.ToProblem(result.Error!, 404));
    }
}
