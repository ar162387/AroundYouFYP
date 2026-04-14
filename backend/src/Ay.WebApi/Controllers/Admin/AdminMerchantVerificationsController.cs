using Ay.Application.Merchant.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ay.WebApi.Controllers.Admin;

[ApiController]
[Route("api/v1/admin/merchant-verifications")]
[Authorize(Policy = "AdminOnly")]
public class AdminMerchantVerificationsController(
    IMerchantVerificationAdminService verificationAdminService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var result = await verificationAdminService.ListSubmittedIdentitiesAsync();
        if (!result.IsSuccess)
            return StatusCode(500, new { message = result.Error });

        return Ok(result.Value);
    }

    [HttpPost("{merchantId:guid}/approve")]
    public async Task<IActionResult> Approve(Guid merchantId)
    {
        var result = await verificationAdminService.ApproveAsync(merchantId);
        if (!result.IsSuccess)
            return NotFound(new { message = result.Error });

        return NoContent();
    }

    [HttpPost("{merchantId:guid}/reject")]
    public async Task<IActionResult> Reject(Guid merchantId)
    {
        var result = await verificationAdminService.RejectAsync(merchantId);
        if (!result.IsSuccess)
            return NotFound(new { message = result.Error });

        return NoContent();
    }
}
