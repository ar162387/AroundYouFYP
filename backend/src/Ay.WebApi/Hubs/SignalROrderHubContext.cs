using Ay.Application.Notifications;
using Microsoft.AspNetCore.SignalR;

namespace Ay.WebApi.Hubs;

public class SignalROrderHubContext(IHubContext<OrderHub> hub) : IOrderHubContext
{
    public Task NotifyOrderUpdatedAsync(Guid orderId, string status, CancellationToken ct = default)
        => hub.Clients.Group($"order:{orderId}")
               .SendAsync("OrderStatusChanged", new { orderId, status }, ct);

    public Task NotifyShopNewOrderAsync(Guid shopId, Guid orderId, string orderNumber, CancellationToken ct = default)
        => hub.Clients.Group($"shop-orders:{shopId}")
               .SendAsync("NewOrder", new { shopId, orderId, orderNumber }, ct);
}
