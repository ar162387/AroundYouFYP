namespace Ay.Application.Consumer.DTOs;

public record OrderItemRequest(Guid MerchantItemId, int Quantity);
public record PlaceOrderRequest(Guid ShopId, Guid ConsumerAddressId, OrderItemRequest[] Items, string PaymentMethod = "cash", string? SpecialInstructions = null);
public record CalculateOrderRequest(Guid ShopId, Guid ConsumerAddressId, OrderItemRequest[] Items);

public record OrderCalculationDto(int SubtotalCents, int DeliveryFeeCents, int SurchargeCents, int TotalCents, double DistanceMeters, bool FreeDeliveryApplied);

public record ShopSummaryDto(Guid Id, string Name, string? ImageUrl);
public record ConsumerOrderItemDto(Guid Id, string ItemName, string? ItemDescription, string? ItemImageUrl, int ItemPriceCents, int Quantity, int SubtotalCents);
public record DeliveryAddressSnapshotDto(string? Title, string? StreetAddress, string? City, string? Region, decimal? Latitude, decimal? Longitude, string? Landmark, string? FormattedAddress);
public record RunnerSummaryDto(Guid Id, string Name, string PhoneNumber);
public record ConsumerOrderDto(Guid Id, string OrderNumber, string Status, int SubtotalCents, int DeliveryFeeCents, int SurchargeCents, int TotalCents, string PaymentMethod, string? SpecialInstructions, DateTimeOffset PlacedAt, DateTimeOffset? ConfirmedAt, DateTimeOffset? OutForDeliveryAt, DateTimeOffset? DeliveredAt, DateTimeOffset? CancelledAt, string? CancellationReason, object? DeliveryAddress, ShopSummaryDto? Shop, ConsumerOrderItemDto[] Items, RunnerSummaryDto? DeliveryRunner, bool HasReview);

public record ConsumerCancelOrderRequest(string? Reason);
