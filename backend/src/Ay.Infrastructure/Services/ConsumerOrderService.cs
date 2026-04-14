using System.Text.Json;
using Ay.Application.Consumer.DTOs;
using Ay.Application.Consumer.Services;
using Ay.Application.Notifications;
using Ay.Domain.Common;
using Ay.Domain.Entities;
using Ay.Domain.Interfaces;
using Ay.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Geometries;

namespace Ay.Infrastructure.Services;

public class ConsumerOrderService(
    AppDbContext context,
    IOrderRepository orderRepo,
    IConsumerAddressRepository addressRepo,
    IUserProfileRepository profileRepo,
    IDeliveryFeeCalculatorService feeCalc,
    IOrderHubContext orderHub,
    INotificationService notifications,
    ILogger<ConsumerOrderService> logger) : IConsumerOrderService
{
    private static readonly GeometryFactory GeomFactory = new(new PrecisionModel(), 4326);

    public async Task<Result<OrderCalculationDto>> CalculateAsync(Guid userId, CalculateOrderRequest request)
    {
        var addr = await addressRepo.GetByIdAsync(request.ConsumerAddressId);
        if (addr is null || addr.UserId != userId) return Result.Failure<OrderCalculationDto>("Address not found.");

        var shop = await context.Shops
            .Include(s => s.MerchantAccount)
            .Include(s => s.DeliveryLogic)
            .FirstOrDefaultAsync(s => s.Id == request.ShopId);
        if (shop is null) return Result.Failure<OrderCalculationDto>("Shop not found.");
        if (shop.MerchantAccount is null || shop.MerchantAccount.Status != "verified")
            return Result.Failure<OrderCalculationDto>("Shop is not available.");
        if (!await IsWithinDeliveryAreaAsync(shop.Id, (double)addr.Latitude, (double)addr.Longitude))
            return Result.Failure<OrderCalculationDto>("Shop does not deliver to this address.");
        if (!ShopOpenStatusHelper.IsOpenNow(shop))
            return Result.Failure<OrderCalculationDto>("Shop is closed.");

        var itemIds = request.Items.Select(i => i.MerchantItemId).ToList();
        var items = await context.MerchantItems.Where(i => itemIds.Contains(i.Id) && i.ShopId == shop.Id).ToListAsync();

        int subtotalCents = 0;
        foreach (var ri in request.Items)
        {
            var item = items.FirstOrDefault(i => i.Id == ri.MerchantItemId);
            if (item is null || !item.IsActive) return Result.Failure<OrderCalculationDto>($"Item not available.");
            subtotalCents += item.PriceCents * ri.Quantity;
        }

        var dist = feeCalc.CalculateDistance((double)addr.Latitude, (double)addr.Longitude, shop.Latitude, shop.Longitude);
        var subtotalPkr = subtotalCents / 100m;

        if (shop.DeliveryLogic is not null && subtotalPkr < shop.DeliveryLogic.LeastOrderValue)
            return Result.Failure<OrderCalculationDto>($"Minimum order is PKR {shop.DeliveryLogic.LeastOrderValue}.");

        var breakdown = shop.DeliveryLogic is not null
            ? feeCalc.CalculateFee(subtotalPkr, dist, shop.DeliveryLogic)
            : new OrderFeeBreakdown(0, 0, false, dist);

        var totalCents = subtotalCents + breakdown.DeliveryFeeCents + breakdown.SurchargeCents;

        return Result.Success(new OrderCalculationDto(subtotalCents, breakdown.DeliveryFeeCents, breakdown.SurchargeCents, totalCents, Math.Round(dist, 1), breakdown.FreeDeliveryApplied));
    }

    public async Task<Result<ConsumerOrderDto>> PlaceOrderAsync(Guid userId, PlaceOrderRequest request)
    {
        var addr = await addressRepo.GetByIdAsync(request.ConsumerAddressId);
        if (addr is null || addr.UserId != userId) return Result.Failure<ConsumerOrderDto>("Address not found.");

        var shop = await context.Shops
            .Include(s => s.MerchantAccount)
            .Include(s => s.DeliveryLogic)
            .FirstOrDefaultAsync(s => s.Id == request.ShopId);
        if (shop is null) return Result.Failure<ConsumerOrderDto>("Shop not found.");
        if (shop.MerchantAccount is null || shop.MerchantAccount.Status != "verified")
            return Result.Failure<ConsumerOrderDto>("Shop is not available.");
        if (!await IsWithinDeliveryAreaAsync(shop.Id, (double)addr.Latitude, (double)addr.Longitude))
            return Result.Failure<ConsumerOrderDto>("Shop does not deliver to this address.");
        if (!ShopOpenStatusHelper.IsOpenNow(shop))
            return Result.Failure<ConsumerOrderDto>("Shop is closed.");

        var itemIds = request.Items.Select(i => i.MerchantItemId).ToList();
        var merchantItems = await context.MerchantItems.Where(i => itemIds.Contains(i.Id) && i.ShopId == shop.Id).ToListAsync();

        int subtotalCents = 0;
        var orderItems = new List<OrderItem>();
        foreach (var ri in request.Items)
        {
            var mi = merchantItems.FirstOrDefault(i => i.Id == ri.MerchantItemId);
            if (mi is null || !mi.IsActive) return Result.Failure<ConsumerOrderDto>($"Item '{mi?.Name ?? "unknown"}' is not available.");
            var lineTotal = mi.PriceCents * ri.Quantity;
            subtotalCents += lineTotal;
            orderItems.Add(new OrderItem
            {
                Id = Guid.NewGuid(),
                MerchantItemId = mi.Id,
                ItemName = mi.Name ?? "",
                ItemDescription = mi.Description,
                ItemImageUrl = mi.ImageUrl,
                ItemPriceCents = mi.PriceCents,
                Quantity = ri.Quantity,
                SubtotalCents = lineTotal,
            });
        }

        var subtotalPkr = subtotalCents / 100m;
        if (shop.DeliveryLogic is not null && subtotalPkr < shop.DeliveryLogic.LeastOrderValue)
            return Result.Failure<ConsumerOrderDto>($"Minimum order is PKR {shop.DeliveryLogic.LeastOrderValue}.");

        var dist = feeCalc.CalculateDistance((double)addr.Latitude, (double)addr.Longitude, shop.Latitude, shop.Longitude);
        var breakdown = shop.DeliveryLogic is not null
            ? feeCalc.CalculateFee(subtotalPkr, dist, shop.DeliveryLogic)
            : new OrderFeeBreakdown(0, 0, false, dist);

        var profile = await profileRepo.GetByUserIdAsync(userId);

        var orderNumber = await orderRepo.GenerateOrderNumberAsync();

        var addrSnapshot = JsonSerializer.SerializeToDocument(new
        {
            id = addr.Id.ToString(),
            title = addr.Title,
            street_address = addr.StreetAddress,
            city = addr.City,
            region = addr.Region,
            latitude = addr.Latitude,
            longitude = addr.Longitude,
            landmark = addr.Landmark,
            formatted_address = addr.FormattedAddress,
        });

        var order = new Order
        {
            Id = Guid.NewGuid(),
            OrderNumber = orderNumber,
            ShopId = shop.Id,
            UserId = userId,
            ConsumerAddressId = addr.Id,
            Status = "pending",
            SubtotalCents = subtotalCents,
            DeliveryFeeCents = breakdown.DeliveryFeeCents,
            SurchargeCents = breakdown.SurchargeCents,
            TotalCents = subtotalCents + breakdown.DeliveryFeeCents + breakdown.SurchargeCents,
            PaymentMethod = request.PaymentMethod,
            SpecialInstructions = request.SpecialInstructions,
            DeliveryAddress = addrSnapshot,
            CustomerName = profile?.Name,
            CustomerEmail = profile?.Email,
            OrderItems = orderItems,
        };

        context.Orders.Add(order);
        await context.SaveChangesAsync();

        logger.LogInformation("Order {OrderNumber} placed by user {UserId}", orderNumber, userId);

        var created = await context.Orders
            .Include(o => o.OrderItems)
            .Include(o => o.Shop)
            .FirstOrDefaultAsync(o => o.Id == order.Id);

        // Real-time: broadcast to merchant's shop group
        await orderHub.NotifyShopNewOrderAsync(shop.Id, order.Id, orderNumber.ToString());

        // Push: notify merchant (shop owner) about new order
        var merchantUserId = await context.MerchantAccounts
            .Where(m => m.Id == shop.MerchantId)
            .Select(m => m.UserId)
            .FirstOrDefaultAsync();
        if (merchantUserId != Guid.Empty)
        {
            _ = notifications.SendAsync(
                merchantUserId, "merchant",
                "New Order!",
                $"Order #{orderNumber} received at {shop.Name}.",
                new Dictionary<string, string> { ["orderId"] = order.Id.ToString(), ["shopId"] = shop.Id.ToString() });
        }

        return Result.Success(ToDto(created!, false));
    }

    public async Task<Result<List<ConsumerOrderDto>>> GetUserOrdersAsync(Guid userId)
    {
        var orders = await context.Orders
            .Where(o => o.UserId == userId)
            .Include(o => o.OrderItems)
            .Include(o => o.Shop)
            .Include(o => o.DeliveryRunner)
            .OrderByDescending(o => o.PlacedAt)
            .ToListAsync();

        var orderIds = orders.Select(o => o.Id).ToList();
        var reviewedOrderIds = await context.Reviews
            .Where(r => r.UserId == userId && r.OrderId != null && orderIds.Contains(r.OrderId.Value))
            .Select(r => r.OrderId!.Value)
            .ToListAsync();

        return Result.Success(orders.Select(o => ToDto(o, reviewedOrderIds.Contains(o.Id))).ToList());
    }

    public async Task<Result<ConsumerOrderDto>> GetOrderByIdAsync(Guid orderId, Guid userId)
    {
        var order = await context.Orders
            .Include(o => o.OrderItems).Include(o => o.Shop).Include(o => o.DeliveryRunner)
            .FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId);
        if (order is null) return Result.Failure<ConsumerOrderDto>("Order not found.");
        var hasReview = await context.Reviews.AnyAsync(r => r.UserId == userId && r.OrderId == orderId);
        return Result.Success(ToDto(order, hasReview));
    }

    public async Task<Result<ConsumerOrderDto?>> GetActiveOrderAsync(Guid userId)
    {
        var terminal = new[] { "delivered", "cancelled" };
        var order = await context.Orders
            .Include(o => o.OrderItems).Include(o => o.Shop).Include(o => o.DeliveryRunner)
            .Where(o => o.UserId == userId && !terminal.Contains(o.Status))
            .OrderByDescending(o => o.PlacedAt)
            .FirstOrDefaultAsync();
        if (order is null) return Result.Success<ConsumerOrderDto?>(null);
        return Result.Success<ConsumerOrderDto?>(ToDto(order, false));
    }

    public async Task<Result> CancelOrderAsync(Guid orderId, Guid userId, string? reason)
    {
        var order = await context.Orders
            .Include(o => o.Shop)
            .FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId);
        if (order is null) return Result.Failure("Order not found.");
        if (order.Status != "pending") return Result.Failure("Order cannot be cancelled at this stage.");
        order.Status = "cancelled";
        order.CancelledAt = DateTimeOffset.UtcNow;
        order.CancellationReason = reason ?? "Cancelled by customer";
        order.CancelledBy = userId;
        order.UpdatedAt = DateTimeOffset.UtcNow;
        await context.SaveChangesAsync();

        await orderHub.NotifyOrderUpdatedAsync(orderId, "cancelled");

        // Push: notify merchant
        if (order.Shop is not null)
        {
            var merchantUserId = await context.MerchantAccounts
                .Where(m => m.Id == order.Shop.MerchantId)
                .Select(m => m.UserId)
                .FirstOrDefaultAsync();
            if (merchantUserId != Guid.Empty)
            {
                _ = notifications.SendAsync(
                    merchantUserId, "merchant",
                    "Order Cancelled",
                    $"Order #{order.OrderNumber} was cancelled by the customer.",
                    new Dictionary<string, string> { ["orderId"] = orderId.ToString(), ["status"] = "cancelled" });
            }
        }

        return Result.Success();
    }

    private static ConsumerOrderDto ToDto(Order o, bool hasReview)
    {
        object? deliveryAddr = null;
        try { deliveryAddr = JsonSerializer.Deserialize<object>(o.DeliveryAddress.RootElement.GetRawText()); } catch { }

        ShopSummaryDto? shopDto = o.Shop is not null ? new ShopSummaryDto(o.Shop.Id, o.Shop.Name, o.Shop.ImageUrl) : null;

        return new ConsumerOrderDto(
            o.Id, o.OrderNumber, o.Status,
            o.SubtotalCents, o.DeliveryFeeCents, o.SurchargeCents, o.TotalCents,
            o.PaymentMethod, o.SpecialInstructions,
            o.PlacedAt, o.ConfirmedAt, o.OutForDeliveryAt, o.DeliveredAt,
            o.CancelledAt, o.CancellationReason,
            deliveryAddr, shopDto,
            o.OrderItems.Select(oi => new ConsumerOrderItemDto(
                oi.Id, oi.ItemName, oi.ItemDescription, oi.ItemImageUrl,
                oi.ItemPriceCents, oi.Quantity, oi.SubtotalCents)).ToArray(),
            o.DeliveryRunner is not null ? new RunnerSummaryDto(o.DeliveryRunner.Id, o.DeliveryRunner.Name, o.DeliveryRunner.PhoneNumber) : null,
            hasReview);
    }

    private async Task<bool> IsWithinDeliveryAreaAsync(Guid shopId, double latitude, double longitude)
    {
        var consumerPoint = GeomFactory.CreatePoint(new Coordinate(longitude, latitude));
        consumerPoint.SRID = 4326;

        return await context.ShopDeliveryAreas
            .AnyAsync(a => a.ShopId == shopId && a.Geom.Contains(consumerPoint));
    }
}
