using System.Text.Json;
using Ay.Application.Merchant.DTOs;
using Ay.Application.Merchant.Services;
using Ay.Application.Notifications;
using Ay.Domain.Common;
using Ay.Domain.Entities;
using Ay.Domain.Interfaces;
using Ay.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Ay.Infrastructure.Services;

public class MerchantOrderService(
    IOrderRepository orderRepo,
    IMerchantAccountRepository merchantRepo,
    IShopRepository shopRepo,
    IDeliveryRunnerRepository runnerRepo,
    AppDbContext context,
    IOrderHubContext orderHub,
    INotificationService notifications,
    ILogger<MerchantOrderService> logger) : IMerchantOrderService
{
    private static readonly Dictionary<string, string[]> ValidTransitions = new()
    {
        ["pending"] = ["confirmed", "cancelled"],
        ["confirmed"] = ["out_for_delivery"],
        ["out_for_delivery"] = ["delivered"],
    };

    public async Task<Result<List<MerchantOrderDto>>> GetShopOrdersAsync(Guid shopId, Guid userId, string? statusFilter = null)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure<List<MerchantOrderDto>>(ownership.Error!);

        var orders = await orderRepo.GetByShopIdAsync(shopId, statusFilter);
        return Result.Success(orders.Select(ToDto).ToList());
    }

    public async Task<Result<MerchantOrderDto>> GetOrderByIdAsync(Guid shopId, Guid orderId, Guid userId)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure<MerchantOrderDto>(ownership.Error!);

        var order = await orderRepo.GetByIdWithDetailsAsync(orderId);
        if (order is null || order.ShopId != shopId)
            return Result.Failure<MerchantOrderDto>("Order not found.");

        return Result.Success(ToDto(order));
    }

    public async Task<Result> ConfirmOrderAsync(Guid shopId, Guid orderId, Guid userId)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure(ownership.Error!);

        var order = await orderRepo.GetByIdAsync(orderId);
        if (order is null || order.ShopId != shopId)
            return Result.Failure("Order not found.");

        if (!IsValidTransition(order.Status, "confirmed"))
            return Result.Failure($"Cannot transition from '{order.Status}' to 'confirmed'.");

        order.Status = "confirmed";
        order.ConfirmedAt = DateTimeOffset.UtcNow;
        order.ConfirmationTimeSeconds = (int)(order.ConfirmedAt.Value - order.PlacedAt).TotalSeconds;
        order.UpdatedAt = DateTimeOffset.UtcNow;

        await orderRepo.UpdateAsync(order);
        logger.LogInformation("Order {OrderId} confirmed", orderId);

        await orderHub.NotifyOrderUpdatedAsync(orderId, "confirmed");
        _ = notifications.SendAsync(
            order.UserId,
            "Order Confirmed",
            $"Your order #{order.OrderNumber} has been confirmed.",
            new Dictionary<string, string> { ["orderId"] = orderId.ToString(), ["status"] = "confirmed" });

        return Result.Success();
    }

    public async Task<Result> DispatchOrderAsync(Guid shopId, Guid orderId, Guid userId, Guid runnerId)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure(ownership.Error!);

        var order = await orderRepo.GetByIdAsync(orderId);
        if (order is null || order.ShopId != shopId)
            return Result.Failure("Order not found.");

        if (!IsValidTransition(order.Status, "out_for_delivery"))
            return Result.Failure($"Cannot transition from '{order.Status}' to 'out_for_delivery'.");

        var runner = await runnerRepo.GetByIdAsync(runnerId);
        if (runner is null || runner.ShopId != shopId)
            return Result.Failure("Runner not found or does not belong to this shop.");

        order.Status = "out_for_delivery";
        order.OutForDeliveryAt = DateTimeOffset.UtcNow;
        order.DeliveryRunnerId = runnerId;
        if (order.ConfirmedAt.HasValue)
            order.PreparationTimeSeconds = (int)(order.OutForDeliveryAt.Value - order.ConfirmedAt.Value).TotalSeconds;
        order.UpdatedAt = DateTimeOffset.UtcNow;

        await orderRepo.UpdateAsync(order);
        logger.LogInformation("Order {OrderId} dispatched with runner {RunnerId}", orderId, runnerId);

        await orderHub.NotifyOrderUpdatedAsync(orderId, "out_for_delivery");
        _ = notifications.SendAsync(
            order.UserId,
            "On the Way!",
            $"Your order #{order.OrderNumber} is out for delivery.",
            new Dictionary<string, string> { ["orderId"] = orderId.ToString(), ["status"] = "out_for_delivery" });

        return Result.Success();
    }

    public async Task<Result> MarkDeliveredAsync(Guid shopId, Guid orderId, Guid userId)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure(ownership.Error!);

        var order = await orderRepo.GetByIdWithDetailsAsync(orderId);
        if (order is null || order.ShopId != shopId)
            return Result.Failure("Order not found.");

        if (!IsValidTransition(order.Status, "delivered"))
            return Result.Failure($"Cannot transition from '{order.Status}' to 'delivered'.");

        order.Status = "delivered";
        order.DeliveredAt = DateTimeOffset.UtcNow;
        if (order.OutForDeliveryAt.HasValue)
            order.DeliveryTimeSeconds = (int)(order.DeliveredAt.Value - order.OutForDeliveryAt.Value).TotalSeconds;
        order.UpdatedAt = DateTimeOffset.UtcNow;

        foreach (var oi in order.OrderItems)
        {
            if (oi.MerchantItemId.HasValue)
            {
                var item = await context.MerchantItems.FindAsync(oi.MerchantItemId.Value);
                if (item is not null)
                {
                    item.TimesSold += oi.Quantity;
                    item.TotalRevenueCents += oi.SubtotalCents;
                }
            }
        }

        await orderRepo.UpdateAsync(order);
        await context.SaveChangesAsync();
        logger.LogInformation("Order {OrderId} delivered", orderId);

        await orderHub.NotifyOrderUpdatedAsync(orderId, "delivered");
        _ = notifications.SendAsync(
            order.UserId,
            "Delivered!",
            $"Your order #{order.OrderNumber} has been delivered. Enjoy!",
            new Dictionary<string, string> { ["orderId"] = orderId.ToString(), ["status"] = "delivered" });

        return Result.Success();
    }

    public async Task<Result> CancelOrderAsync(Guid shopId, Guid orderId, Guid userId, string reason)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure(ownership.Error!);

        var order = await orderRepo.GetByIdAsync(orderId);
        if (order is null || order.ShopId != shopId)
            return Result.Failure("Order not found.");

        if (!IsValidTransition(order.Status, "cancelled"))
            return Result.Failure($"Cannot transition from '{order.Status}' to 'cancelled'.");

        order.Status = "cancelled";
        order.CancelledAt = DateTimeOffset.UtcNow;
        order.CancellationReason = reason;
        order.CancelledBy = userId;
        order.UpdatedAt = DateTimeOffset.UtcNow;

        await orderRepo.UpdateAsync(order);
        logger.LogInformation("Order {OrderId} cancelled by merchant", orderId);

        await orderHub.NotifyOrderUpdatedAsync(orderId, "cancelled");
        _ = notifications.SendAsync(
            order.UserId,
            "Order Cancelled",
            $"Your order #{order.OrderNumber} was cancelled by the merchant.",
            new Dictionary<string, string> { ["orderId"] = orderId.ToString(), ["status"] = "cancelled" });

        return Result.Success();
    }

    public async Task<Result<OrderAnalyticsDto>> GetAnalyticsAsync(Guid shopId, Guid userId)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure<OrderAnalyticsDto>(ownership.Error!);

        var orders = await context.Orders.Where(o => o.ShopId == shopId).ToListAsync();

        var totalOrders = orders.Count;
        var totalRevenue = orders.Where(o => o.Status == "delivered").Sum(o => (long)o.TotalCents);
        var avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        var delivered = orders.Where(o => o.Status == "delivered").ToList();
        var avgConfirmation = delivered.Where(o => o.ConfirmationTimeSeconds.HasValue)
            .Select(o => o.ConfirmationTimeSeconds!.Value).DefaultIfEmpty().Average();
        var avgPreparation = delivered.Where(o => o.PreparationTimeSeconds.HasValue)
            .Select(o => o.PreparationTimeSeconds!.Value).DefaultIfEmpty().Average();
        var avgDelivery = delivered.Where(o => o.DeliveryTimeSeconds.HasValue)
            .Select(o => o.DeliveryTimeSeconds!.Value).DefaultIfEmpty().Average();

        var statusBreakdown = orders.GroupBy(o => o.Status)
            .ToDictionary(g => g.Key, g => g.Count());

        return Result.Success(new OrderAnalyticsDto(
            totalOrders, totalRevenue, avgOrder,
            (int?)avgConfirmation, (int?)avgPreparation, (int?)avgDelivery,
            statusBreakdown));
    }

    private static bool IsValidTransition(string from, string to)
    {
        return ValidTransitions.TryGetValue(from, out var allowed) && allowed.Contains(to);
    }

    private async Task<Result<Shop>> VerifyOwnershipAsync(Guid shopId, Guid userId)
    {
        var merchant = await merchantRepo.GetByUserIdAsync(userId);
        if (merchant is null) return Result.Failure<Shop>("Merchant account not found.");
        var shop = await shopRepo.GetByIdAsync(shopId);
        if (shop is null) return Result.Failure<Shop>("Shop not found.");
        if (shop.MerchantId != merchant.Id) return Result.Failure<Shop>("Access denied.");
        return Result.Success(shop);
    }

    private static MerchantOrderDto ToDto(Order o)
    {
        object? deliveryAddr = null;
        try { deliveryAddr = JsonSerializer.Deserialize<object>(o.DeliveryAddress.RootElement.GetRawText()); } catch { }

        return new MerchantOrderDto(
            o.Id, o.OrderNumber, o.Status,
            o.SubtotalCents, o.DeliveryFeeCents, o.SurchargeCents, o.TotalCents,
            o.PaymentMethod, o.SpecialInstructions,
            o.PlacedAt, o.ConfirmedAt, o.OutForDeliveryAt, o.DeliveredAt,
            o.CancelledAt, o.CancellationReason,
            o.CustomerName, o.CustomerEmail,
            deliveryAddr,
            o.OrderItems.Select(oi => new OrderItemDto(
                oi.Id, oi.ItemName, oi.ItemDescription, oi.ItemImageUrl,
                oi.ItemPriceCents, oi.Quantity, oi.SubtotalCents)).ToArray(),
            o.DeliveryRunner is not null
                ? new RunnerSummaryDto(o.DeliveryRunner.Id, o.DeliveryRunner.Name, o.DeliveryRunner.PhoneNumber)
                : null);
    }
}
