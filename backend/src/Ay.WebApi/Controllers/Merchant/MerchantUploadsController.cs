using Ay.Application.Merchant.Services;
using Ay.Application.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ay.WebApi.Controllers.Merchant;

/// <summary>
/// Image-upload endpoints for merchant-owned shops and their items. Files are stored on Cloudinary; the response
/// contains a secure HTTPS URL for the <c>imageUrl</c> field.
/// </summary>
[ApiController]
[Route("api/v1/merchant")]
[Authorize(Roles = "merchant")]
public class MerchantUploadsController(
    IShopService shopService,
    IInventoryService inventoryService,
    IFileStorageService fileStorage) : ControllerBase
{
    private const long MaxFileSizeBytes = 5 * 1024 * 1024; // 5 MB

    // PUT api/v1/merchant/shops/{shopId}/image
    [HttpPut("shops/{shopId:guid}/image")]
    [RequestSizeLimit(MaxFileSizeBytes)]
    public async Task<IActionResult> UploadShopImage(Guid shopId, IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest(MerchantHttp.ToProblem("No file provided.", 400));

        if (file.Length > MaxFileSizeBytes)
            return BadRequest(MerchantHttp.ToProblem("File exceeds the 5 MB limit.", 400));

        string imageUrl;
        try
        {
            await using var stream = file.OpenReadStream();
            imageUrl = await fileStorage.SaveAsync(stream, file.FileName, "shops");
        }
        catch (InvalidOperationException ex)
        {
            return UnprocessableEntity(MerchantHttp.ToProblem(ex.Message, 422));
        }

        var userId = MerchantHttp.GetUserId(User);
        var result = await shopService.UpdateImageAsync(shopId, userId, imageUrl);
        return result.IsSuccess ? Ok(new { imageUrl }) : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }

    // PUT api/v1/merchant/shops/{shopId}/inventory/{itemId}/image
    [HttpPut("shops/{shopId:guid}/inventory/{itemId:guid}/image")]
    [RequestSizeLimit(MaxFileSizeBytes)]
    public async Task<IActionResult> UploadItemImage(Guid shopId, Guid itemId, IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest(MerchantHttp.ToProblem("No file provided.", 400));

        if (file.Length > MaxFileSizeBytes)
            return BadRequest(MerchantHttp.ToProblem("File exceeds the 5 MB limit.", 400));

        string imageUrl;
        try
        {
            await using var stream = file.OpenReadStream();
            imageUrl = await fileStorage.SaveAsync(stream, file.FileName, "items");
        }
        catch (InvalidOperationException ex)
        {
            return UnprocessableEntity(MerchantHttp.ToProblem(ex.Message, 422));
        }

        var userId = MerchantHttp.GetUserId(User);
        var result = await inventoryService.UpdateItemImageAsync(shopId, itemId, userId, imageUrl);
        return result.IsSuccess ? Ok(new { imageUrl }) : NotFound(MerchantHttp.ToProblem(result.Error!, 404));
    }
}
