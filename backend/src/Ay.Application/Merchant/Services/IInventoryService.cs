using Ay.Application.Merchant.DTOs;
using Ay.Domain.Common;

namespace Ay.Application.Merchant.Services;

public interface IInventoryService
{
    Task<Result<List<CategoryDto>>> GetCategoriesAsync(Guid shopId, Guid userId);
    Task<Result<CategoryDto>> CreateCategoryAsync(Guid shopId, Guid userId, CreateCategoryRequest request);
    Task<Result<CategoryDto>> UpdateCategoryAsync(Guid shopId, Guid categoryId, Guid userId, UpdateCategoryRequest request);
    Task<Result> DeleteCategoryAsync(Guid shopId, Guid categoryId, Guid userId);
    Task<Result<List<CategoryTemplateDto>>> GetCategoryTemplatesAsync();

    Task<Result<List<MerchantItemDto>>> GetItemsAsync(Guid shopId, Guid userId);
    Task<Result<MerchantItemDto>> GetItemByIdAsync(Guid shopId, Guid itemId, Guid userId);
    Task<Result<MerchantItemDto>> CreateItemAsync(Guid shopId, Guid userId, CreateItemRequest request);
    Task<Result<MerchantItemDto>> UpdateItemAsync(Guid shopId, Guid itemId, Guid userId, UpdateItemRequest request);
    Task<Result> UpdateItemImageAsync(Guid shopId, Guid itemId, Guid userId, string imageUrl);
    Task<Result> DeleteItemAsync(Guid shopId, Guid itemId, Guid userId);
    Task<Result<List<ItemTemplateDto>>> SearchItemTemplatesAsync(string? search);

    Task<Result<MerchantItemAuditLogResponseDto>> GetItemAuditLogAsync(
        Guid shopId,
        Guid userId,
        int limit = 50,
        Guid? merchantItemId = null);
}
