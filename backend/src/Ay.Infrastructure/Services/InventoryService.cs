using System.Text.Json;
using Ay.Application.Merchant.DTOs;
using Ay.Application.Merchant.Services;
using Ay.Domain.Common;
using Ay.Domain.Entities;
using Ay.Domain.Interfaces;

namespace Ay.Infrastructure.Services;

public class InventoryService(
    ICategoryRepository categoryRepo,
    IItemRepository itemRepo,
    IMerchantAccountRepository merchantRepo,
    IShopRepository shopRepo,
    IMerchantItemAuditService itemAuditService) : IInventoryService
{
    private static string? NormalizeOptionalText(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    public async Task<Result<List<CategoryDto>>> GetCategoriesAsync(Guid shopId, Guid userId)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure<List<CategoryDto>>(ownership.Error!);

        var cats = await categoryRepo.GetByShopIdAsync(shopId);
        return Result.Success(cats.Select(c => new CategoryDto(c.Id, c.ShopId, c.Name, c.Description, c.IsCustom, c.IsActive, c.TemplateId, c.CreatedAt)).ToList());
    }

    public async Task<Result<CategoryDto>> CreateCategoryAsync(Guid shopId, Guid userId, CreateCategoryRequest request)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure<CategoryDto>(ownership.Error!);

        var cat = new MerchantCategory
        {
            Id = Guid.NewGuid(),
            ShopId = shopId,
            Name = request.Name,
            Description = request.Description,
            TemplateId = request.TemplateId,
            IsCustom = request.TemplateId is null,
        };

        await categoryRepo.CreateAsync(cat);
        return Result.Success(new CategoryDto(cat.Id, cat.ShopId, cat.Name, cat.Description, cat.IsCustom, cat.IsActive, cat.TemplateId, cat.CreatedAt));
    }

    public async Task<Result<CategoryDto>> UpdateCategoryAsync(Guid shopId, Guid categoryId, Guid userId, UpdateCategoryRequest request)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure<CategoryDto>(ownership.Error!);

        var cat = await categoryRepo.GetByIdAsync(categoryId);
        if (cat is null || cat.ShopId != shopId)
            return Result.Failure<CategoryDto>("Category not found.");

        if (request.Name is not null) cat.Name = request.Name;
        if (request.Description is not null) cat.Description = request.Description;
        if (request.IsActive.HasValue) cat.IsActive = request.IsActive.Value;
        cat.UpdatedAt = DateTimeOffset.UtcNow;

        await categoryRepo.UpdateAsync(cat);
        return Result.Success(new CategoryDto(cat.Id, cat.ShopId, cat.Name, cat.Description, cat.IsCustom, cat.IsActive, cat.TemplateId, cat.CreatedAt));
    }

    public async Task<Result> DeleteCategoryAsync(Guid shopId, Guid categoryId, Guid userId)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure(ownership.Error!);

        var cat = await categoryRepo.GetByIdAsync(categoryId);
        if (cat is null || cat.ShopId != shopId)
            return Result.Failure("Category not found.");

        await categoryRepo.DeleteAsync(cat);
        return Result.Success();
    }

    public async Task<Result<List<CategoryTemplateDto>>> GetCategoryTemplatesAsync()
    {
        var templates = await categoryRepo.GetTemplatesAsync();
        return Result.Success(templates.Select(t => new CategoryTemplateDto(t.Id, t.Name, t.Description)).ToList());
    }

    public async Task<Result<List<MerchantItemDto>>> GetItemsAsync(Guid shopId, Guid userId)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure<List<MerchantItemDto>>(ownership.Error!);

        var items = await itemRepo.GetByShopIdAsync(shopId);
        return Result.Success(items.Select(ToItemDto).ToList());
    }

    public async Task<Result<MerchantItemDto>> GetItemByIdAsync(Guid shopId, Guid itemId, Guid userId)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure<MerchantItemDto>(ownership.Error!);

        var item = await itemRepo.GetByIdWithCategoriesAsync(itemId);
        if (item is null || item.ShopId != shopId)
            return Result.Failure<MerchantItemDto>("Item not found.");

        return Result.Success(ToItemDto(item));
    }

    public async Task<Result<MerchantItemDto>> CreateItemAsync(Guid shopId, Guid userId, CreateItemRequest request)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure<MerchantItemDto>(ownership.Error!);

        var item = new MerchantItem
        {
            Id = Guid.NewGuid(),
            ShopId = shopId,
            Name = request.Name,
            Description = request.Description,
            PriceCents = request.PriceCents,
            TemplateId = request.TemplateId,
            Barcode = NormalizeOptionalText(request.Barcode),
            Sku = NormalizeOptionalText(request.Sku),
            ImageUrl = NormalizeOptionalText(request.ImageUrl),
            IsActive = request.IsActive,
            IsCustom = request.TemplateId is null,
            CreatedBy = userId,
        };

        await itemRepo.CreateAsync(item);

        if (request.CategoryIds is { Length: > 0 })
            await itemRepo.SetItemCategoriesAsync(item.Id, request.CategoryIds);

        await itemAuditService.LogItemCreatedAsync(shopId, item.Id, userId, item.Name ?? "", item.PriceCents);

        var created = await itemRepo.GetByIdWithCategoriesAsync(item.Id);
        return Result.Success(ToItemDto(created!));
    }

    public async Task<Result<MerchantItemDto>> UpdateItemAsync(Guid shopId, Guid itemId, Guid userId, UpdateItemRequest request)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure<MerchantItemDto>(ownership.Error!);

        var item = await itemRepo.GetByIdWithCategoriesAsync(itemId);
        if (item is null || item.ShopId != shopId)
            return Result.Failure<MerchantItemDto>("Item not found.");

        var changes = new Dictionary<string, object?>();

        if (request.Name is not null && request.Name != item.Name)
        {
            changes["name"] = new { from = item.Name, to = request.Name };
            item.Name = request.Name;
        }
        if (request.Description is not null && request.Description != item.Description)
        {
            changes["description"] = new { from = item.Description, to = request.Description };
            item.Description = request.Description;
        }
        if (request.PriceCents.HasValue && request.PriceCents.Value != item.PriceCents)
        {
            changes["price_cents"] = new { from = item.PriceCents, to = request.PriceCents.Value };
            item.PriceCents = request.PriceCents.Value;
        }
        if (request.Barcode is not null)
        {
            var newBarcode = NormalizeOptionalText(request.Barcode);
            if (newBarcode != item.Barcode)
            {
                changes["barcode"] = new { from = item.Barcode, to = newBarcode };
                item.Barcode = newBarcode;
            }
        }
        if (request.Sku is not null)
        {
            var newSku = NormalizeOptionalText(request.Sku);
            if (newSku != item.Sku)
            {
                changes["sku"] = new { from = item.Sku, to = newSku };
                item.Sku = newSku;
            }
        }
        if (request.ImageUrl is not null)
        {
            var newImageUrl = NormalizeOptionalText(request.ImageUrl);
            if (newImageUrl != item.ImageUrl)
            {
                changes["image_url"] = new { from = item.ImageUrl, to = newImageUrl };
                item.ImageUrl = newImageUrl;
            }
        }
        if (request.IsActive.HasValue && request.IsActive.Value != item.IsActive)
        {
            changes["is_active"] = new { from = item.IsActive, to = request.IsActive.Value };
            item.IsActive = request.IsActive.Value;
        }

        if (request.CategoryIds is not null)
        {
            var previousCategoryIds = item.ItemCategories
                .OrderBy(ic => ic.SortOrder)
                .Select(ic => ic.MerchantCategoryId)
                .ToArray();
            if (!previousCategoryIds.SequenceEqual(request.CategoryIds))
                changes["category_ids"] = new { from = previousCategoryIds, to = request.CategoryIds };
        }

        item.LastUpdatedBy = JsonSerializer.SerializeToDocument(new { id = userId.ToString(), role = "merchant" });
        item.UpdatedAt = DateTimeOffset.UtcNow;
        await itemRepo.UpdateAsync(item);

        if (request.CategoryIds is not null)
            await itemRepo.SetItemCategoriesAsync(itemId, request.CategoryIds);

        await itemAuditService.LogItemFieldChangesAsync(shopId, itemId, userId, changes);

        var updated = await itemRepo.GetByIdWithCategoriesAsync(itemId);
        return Result.Success(ToItemDto(updated!));
    }

    public async Task<Result> UpdateItemImageAsync(Guid shopId, Guid itemId, Guid userId, string imageUrl)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure(ownership.Error!);

        var item = await itemRepo.GetByIdAsync(itemId);
        if (item is null || item.ShopId != shopId)
            return Result.Failure("Item not found.");

        var previousUrl = item.ImageUrl;
        item.ImageUrl = imageUrl;
        item.UpdatedAt = DateTimeOffset.UtcNow;
        await itemRepo.UpdateAsync(item);
        await itemAuditService.LogItemImageUpdatedAsync(shopId, itemId, userId, previousUrl, imageUrl);
        return Result.Success();
    }

    public async Task<Result> DeleteItemAsync(Guid shopId, Guid itemId, Guid userId)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure(ownership.Error!);

        var item = await itemRepo.GetByIdAsync(itemId);
        if (item is null || item.ShopId != shopId)
            return Result.Failure("Item not found.");

        await itemAuditService.LogItemDeletedAsync(shopId, itemId, userId, item.Name ?? "", item.PriceCents);
        await itemRepo.DeleteAsync(item);
        return Result.Success();
    }

    public async Task<Result<List<ItemTemplateDto>>> SearchItemTemplatesAsync(string? search)
    {
        var templates = await itemRepo.SearchTemplatesAsync(search);
        return Result.Success(templates.Select(t => new ItemTemplateDto(t.Id, t.Name, t.Barcode, t.Description, t.ImageUrl, t.DefaultUnit)).ToList());
    }

    public async Task<Result<MerchantItemAuditLogResponseDto>> GetItemAuditLogAsync(
        Guid shopId,
        Guid userId,
        int limit = 50,
        Guid? merchantItemId = null)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure<MerchantItemAuditLogResponseDto>(ownership.Error!);

        var entries = await itemAuditService.ListEntriesForShopAsync(shopId, limit, merchantItemId);
        return Result.Success(new MerchantItemAuditLogResponseDto(entries, null));
    }

    private async Task<Result<Shop>> VerifyOwnershipAsync(Guid shopId, Guid userId)
    {
        var merchant = await merchantRepo.GetByUserIdAsync(userId);
        if (merchant is null) return Result.Failure<Shop>("Merchant account not found.");
        var shop = await shopRepo.GetByIdAsync(shopId);
        if (shop is null) return Result.Failure<Shop>("Shop not found.");
        if (shop.MerchantId != merchant.Id) return Result.Failure<Shop>("Access denied.");
        return Result.Success(shop);
    }

    private static MerchantItemDto ToItemDto(MerchantItem i) => new(
        i.Id, i.ShopId, i.Name, i.Description, i.PriceCents, i.Currency,
        i.ImageUrl, i.Barcode, i.Sku, i.IsActive, i.IsCustom,
        i.TimesSold, i.TotalRevenueCents,
        i.ItemCategories.Select(ic => new CategorySummaryDto(ic.MerchantCategoryId, ic.MerchantCategory?.Name ?? "")).ToArray(),
        i.TemplateId, i.CreatedAt, i.UpdatedAt);
}
