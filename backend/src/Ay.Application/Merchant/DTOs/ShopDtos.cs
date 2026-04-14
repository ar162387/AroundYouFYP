using System.Text.Json;

namespace Ay.Application.Merchant.DTOs;

public record CreateShopRequest(string Name, string Description, string ShopType, string Address, double Latitude, double Longitude, string[]? Tags = null, JsonDocument? OpeningHours = null, string? OpenStatusMode = null);
public record UpdateShopRequest(string? Name = null, string? Description = null, string? Address = null, double? Latitude = null, double? Longitude = null, string[]? Tags = null, JsonDocument? OpeningHours = null, string? OpenStatusMode = null, bool? IsOpen = null);
public record ShopDto(
    Guid Id,
    Guid MerchantId,
    string Name,
    string Description,
    string ShopType,
    string Address,
    double Latitude,
    double Longitude,
    string? ImageUrl,
    string[] Tags,
    bool IsOpen,
    string OpenStatusMode,
    JsonDocument? OpeningHours,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    int OrdersToday,
    int OrdersCancelledToday,
    int RevenueTodayPkr);
