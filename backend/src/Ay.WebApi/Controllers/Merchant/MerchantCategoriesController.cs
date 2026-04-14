using Ay.Application.Merchant.DTOs;
using Ay.Application.Merchant.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ay.WebApi.Controllers.Merchant;

[ApiController]
[Route("api/v1/merchant")]
[Authorize(Roles = "merchant")]
public class MerchantCategoriesController(IInventoryService inventoryService) : ControllerBase
{
    [HttpGet("shops/{shopId:guid}/categories")]
    public async Task<IActionResult> GetCategories(Guid shopId)
    {
        var result = await inventoryService.GetCategoriesAsync(shopId, MerchantHttp.GetUserId(User));
        return result.IsSuccess ? Ok(result.Value) : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }

    [HttpPost("shops/{shopId:guid}/categories")]
    public async Task<IActionResult> CreateCategory(Guid shopId, CreateCategoryRequest request)
    {
        var result = await inventoryService.CreateCategoryAsync(shopId, MerchantHttp.GetUserId(User), request);
        return result.IsSuccess ? Ok(result.Value) : UnprocessableEntity(MerchantHttp.ToProblem(result.Error!, 422));
    }

    [HttpPut("shops/{shopId:guid}/categories/{catId:guid}")]
    public async Task<IActionResult> UpdateCategory(Guid shopId, Guid catId, UpdateCategoryRequest request)
    {
        var result = await inventoryService.UpdateCategoryAsync(shopId, catId, MerchantHttp.GetUserId(User), request);
        return result.IsSuccess ? Ok(result.Value) : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }

    [HttpDelete("shops/{shopId:guid}/categories/{catId:guid}")]
    public async Task<IActionResult> DeleteCategory(Guid shopId, Guid catId)
    {
        var result = await inventoryService.DeleteCategoryAsync(shopId, catId, MerchantHttp.GetUserId(User));
        return result.IsSuccess ? NoContent() : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }

    [HttpGet("templates/categories")]
    public async Task<IActionResult> GetCategoryTemplates()
    {
        var result = await inventoryService.GetCategoryTemplatesAsync();
        return result.IsSuccess ? Ok(result.Value) : StatusCode(500);
    }
}
