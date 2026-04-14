using Ay.Application.Merchant.DTOs;
using Ay.Application.Merchant.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ay.WebApi.Controllers.Merchant;

[ApiController]
[Route("api/v1/merchant")]
[Authorize(Roles = "merchant")]
public class MerchantItemsController(IInventoryService inventoryService) : ControllerBase
{
    [HttpGet("shops/{shopId:guid}/items")]
    public async Task<IActionResult> GetItems(Guid shopId)
    {
        var result = await inventoryService.GetItemsAsync(shopId, MerchantHttp.GetUserId(User));
        return result.IsSuccess ? Ok(result.Value) : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }

    [HttpGet("shops/{shopId:guid}/items/{itemId:guid}")]
    public async Task<IActionResult> GetItem(Guid shopId, Guid itemId)
    {
        var result = await inventoryService.GetItemByIdAsync(shopId, itemId, MerchantHttp.GetUserId(User));
        return result.IsSuccess ? Ok(result.Value) : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }

    [HttpGet("shops/{shopId:guid}/items/audit-log")]
    public async Task<IActionResult> GetItemAuditLog(
        Guid shopId,
        [FromQuery] int limit = 50,
        [FromQuery] Guid? merchantItemId = null)
    {
        var result = await inventoryService.GetItemAuditLogAsync(shopId, MerchantHttp.GetUserId(User), limit, merchantItemId);
        if (!result.IsSuccess)
            return NotFound(MerchantHttp.ToProblem(result.Error!, 404));

        var page = result.Value!;
        return Ok(new { entries = page.Entries, nextCursor = page.NextCursor });
    }

    [HttpPost("shops/{shopId:guid}/items")]
    public async Task<IActionResult> CreateItem(Guid shopId, CreateItemRequest request)
    {
        var result = await inventoryService.CreateItemAsync(shopId, MerchantHttp.GetUserId(User), request);
        return result.IsSuccess ? Ok(result.Value) : UnprocessableEntity(MerchantHttp.ToProblem(result.Error!, 422));
    }

    [HttpPut("shops/{shopId:guid}/items/{itemId:guid}")]
    public async Task<IActionResult> UpdateItem(Guid shopId, Guid itemId, UpdateItemRequest request)
    {
        var result = await inventoryService.UpdateItemAsync(shopId, itemId, MerchantHttp.GetUserId(User), request);
        return result.IsSuccess ? Ok(result.Value) : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }

    [HttpDelete("shops/{shopId:guid}/items/{itemId:guid}")]
    public async Task<IActionResult> DeleteItem(Guid shopId, Guid itemId)
    {
        var result = await inventoryService.DeleteItemAsync(shopId, itemId, MerchantHttp.GetUserId(User));
        return result.IsSuccess ? NoContent() : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }

    [HttpGet("templates/items")]
    public async Task<IActionResult> SearchItemTemplates([FromQuery] string? search)
    {
        var result = await inventoryService.SearchItemTemplatesAsync(search);
        return result.IsSuccess ? Ok(result.Value) : StatusCode(500);
    }
}
