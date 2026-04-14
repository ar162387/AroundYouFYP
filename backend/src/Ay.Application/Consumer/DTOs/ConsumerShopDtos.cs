using System.Text.Json.Serialization;

namespace Ay.Application.Consumer.DTOs;

public record ConsumerShopDto(Guid Id, string Name, string Description, string ShopType, string Address, double Latitude, double Longitude, string? ImageUrl, string[] Tags, bool IsOpen, double DistanceMeters, decimal DeliveryFee, decimal? MinimumOrderValue, decimal? Rating, int ReviewCount, DateTimeOffset CreatedAt);

/// <summary>Distance tiers use snake_case so consumer clients match existing fee-calculation types.</summary>
public record ConsumerDistanceTierDto(
    [property: JsonPropertyName("max_distance")] decimal MaxDistance,
    [property: JsonPropertyName("fee")] decimal Fee);

public record ConsumerDeliveryLogicDto(
    Guid Id,
    Guid ShopId,
    decimal MinimumOrderValue,
    decimal SmallOrderSurcharge,
    decimal LeastOrderValue,
    string DistanceMode,
    decimal MaxDeliveryFee,
    ConsumerDistanceTierDto[] DistanceTiers,
    decimal BeyondTierFeePerUnit,
    decimal BeyondTierDistanceUnit,
    decimal FreeDeliveryThreshold,
    decimal FreeDeliveryRadius,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record ShopDetailDto(
    Guid Id,
    string Name,
    string Description,
    string ShopType,
    string Address,
    double Latitude,
    double Longitude,
    string? ImageUrl,
    string[] Tags,
    bool IsOpen,
    double DistanceMeters,
    decimal DeliveryFee,
    decimal? MinimumOrderValue,
    decimal? Rating,
    int ReviewCount,
    ConsumerCategoryDto[] Categories,
    DateTimeOffset CreatedAt,
    ConsumerDeliveryLogicDto? DeliveryLogic);

public record ConsumerCategoryDto(Guid Id, string Name, ConsumerItemDto[] Items);
public record ConsumerItemDto(Guid Id, string? Name, string? Description, int PriceCents, string Currency, string? ImageUrl, bool IsActive, int TimesSold);
