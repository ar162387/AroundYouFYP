namespace Ay.Application.Merchant.DTOs;

public record CreateCategoryRequest(string Name, string? Description = null, Guid? TemplateId = null);
public record UpdateCategoryRequest(string? Name = null, string? Description = null, bool? IsActive = null);
public record CategoryDto(Guid Id, Guid ShopId, string Name, string? Description, bool IsCustom, bool IsActive, Guid? TemplateId, DateTimeOffset CreatedAt);
public record CategoryTemplateDto(Guid Id, string Name, string? Description);
public record CategorySummaryDto(Guid Id, string Name);
