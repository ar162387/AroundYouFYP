namespace Ay.Application.Merchant.DTOs;

public record UpdateDeliveryLogicRequest(decimal MinimumOrderValue, decimal SmallOrderSurcharge, decimal LeastOrderValue, string? DistanceMode = null, decimal? MaxDeliveryFee = null, DistanceTierDto[]? DistanceTiers = null, decimal? BeyondTierFeePerUnit = null, decimal? BeyondTierDistanceUnit = null, decimal? FreeDeliveryThreshold = null, decimal? FreeDeliveryRadius = null);
public record DistanceTierDto(decimal MaxDistance, decimal Fee);
public record DeliveryLogicDto(Guid Id, Guid ShopId, decimal MinimumOrderValue, decimal SmallOrderSurcharge, decimal LeastOrderValue, string DistanceMode, decimal MaxDeliveryFee, DistanceTierDto[] DistanceTiers, decimal BeyondTierFeePerUnit, decimal BeyondTierDistanceUnit, decimal FreeDeliveryThreshold, decimal FreeDeliveryRadius, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
