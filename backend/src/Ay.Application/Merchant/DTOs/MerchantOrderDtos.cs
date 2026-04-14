namespace Ay.Application.Merchant.DTOs;

public record DispatchOrderRequest(Guid RunnerId);
public record CancelOrderRequest(string Reason);
public record DeliveryAddressDto(string? Id, string? Title, string? StreetAddress, string? City, string? Region, decimal? Latitude, decimal? Longitude, string? Landmark, string? FormattedAddress);
public record OrderItemDto(Guid Id, string ItemName, string? ItemDescription, string? ItemImageUrl, int ItemPriceCents, int Quantity, int SubtotalCents);
public record RunnerSummaryDto(Guid Id, string Name, string PhoneNumber);
public record MerchantOrderDto(Guid Id, string OrderNumber, string Status, int SubtotalCents, int DeliveryFeeCents, int SurchargeCents, int TotalCents, string PaymentMethod, string? SpecialInstructions, DateTimeOffset PlacedAt, DateTimeOffset? ConfirmedAt, DateTimeOffset? OutForDeliveryAt, DateTimeOffset? DeliveredAt, DateTimeOffset? CancelledAt, string? CancellationReason, string? CustomerName, string? CustomerEmail, object? DeliveryAddress, OrderItemDto[] Items, RunnerSummaryDto? DeliveryRunner);
public record OrderAnalyticsDto(int TotalOrders, long TotalRevenueCents, long AverageOrderValueCents, int? AverageConfirmationTimeSeconds, int? AveragePreparationTimeSeconds, int? AverageDeliveryTimeSeconds, Dictionary<string, int> StatusBreakdown);
