namespace Ay.Application.Notifications;

/// <summary>
/// Abstracts SignalR hub broadcasting so the Application/Infrastructure layers
/// have no reference to the concrete OrderHub in Ay.WebApi.
/// </summary>
public interface IOrderHubContext
{
    /// <summary>Broadcast an order status-change event to the consumer tracking that specific order.</summary>
    Task NotifyOrderUpdatedAsync(Guid orderId, string status, CancellationToken ct = default);

    /// <summary>Broadcast a "new order" event to the merchant group watching their shop's order queue.</summary>
    Task NotifyShopNewOrderAsync(Guid shopId, Guid orderId, string orderNumber, CancellationToken ct = default);
}
