using System.Text.Json;

namespace Ay.Domain.Entities;

public class Order
{
    public Guid Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public Guid? ShopId { get; set; }
    public Guid UserId { get; set; }
    public Guid ConsumerAddressId { get; set; }
    public Guid? DeliveryRunnerId { get; set; }
    public string Status { get; set; } = "pending";
    public int SubtotalCents { get; set; }
    public int DeliveryFeeCents { get; set; }
    public int SurchargeCents { get; set; }
    public int TotalCents { get; set; }
    public string PaymentMethod { get; set; } = "cash";
    public string? SpecialInstructions { get; set; }
    public DateTimeOffset PlacedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ConfirmedAt { get; set; }
    public DateTimeOffset? OutForDeliveryAt { get; set; }
    public DateTimeOffset? DeliveredAt { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }
    public int? ConfirmationTimeSeconds { get; set; }
    public int? PreparationTimeSeconds { get; set; }
    public int? DeliveryTimeSeconds { get; set; }
    public string? CancellationReason { get; set; }
    public Guid? CancelledBy { get; set; }
    public JsonDocument DeliveryAddress { get; set; } = null!;
    public string? CustomerName { get; set; }
    public string? CustomerEmail { get; set; }
    public string? CustomerPhone { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Shop? Shop { get; set; }
    public DeliveryRunner? DeliveryRunner { get; set; }
    public List<OrderItem> OrderItems { get; set; } = [];
}
