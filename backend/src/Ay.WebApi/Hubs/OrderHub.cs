using Microsoft.AspNetCore.SignalR;

namespace Ay.WebApi.Hubs;

public class OrderHub : Hub
{
    public async Task JoinShopGroup(string shopId)
        => await Groups.AddToGroupAsync(Context.ConnectionId, $"shop-orders:{shopId}");

    public async Task LeaveShopGroup(string shopId)
        => await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"shop-orders:{shopId}");

    public async Task JoinOrderGroup(string orderId)
        => await Groups.AddToGroupAsync(Context.ConnectionId, $"order:{orderId}");

    public async Task LeaveOrderGroup(string orderId)
        => await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"order:{orderId}");
}
