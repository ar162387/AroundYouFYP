using System.Text.Json;
using Ay.Application.Merchant.DTOs;
using Ay.Application.Merchant.Services;
using Ay.Domain.Common;
using Ay.Domain.Entities;
using Ay.Domain.Interfaces;
using Ay.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Ay.Infrastructure.Services;

public class ShopService(
    IShopRepository shopRepo,
    IMerchantAccountRepository merchantRepo,
    IDeliveryLogicRepository deliveryLogicRepo,
    AppDbContext db,
    IConfiguration configuration,
    ILogger<ShopService> logger) : IShopService
{
    public async Task<Result<List<ShopDto>>> GetByMerchantAsync(Guid userId)
    {
        var merchant = await merchantRepo.GetByUserIdAsync(userId);
        if (merchant is null)
            return Result.Failure<List<ShopDto>>("Merchant account not found.");

        var shops = await shopRepo.GetByMerchantIdAsync(merchant.Id);
        if (shops.Count == 0)
            return Result.Success(new List<ShopDto>());

        var shopIds = shops.Select(s => s.Id).ToList();
        var (dayStartUtc, dayEndUtc) = GetMerchantDayRangeUtc(configuration);
        var kpis = await LoadShopKpisAsync(shopIds, dayStartUtc, dayEndUtc);

        return Result.Success(shops.Select(s => ToDto(
            s,
            kpis.OrdersToday.GetValueOrDefault(s.Id),
            kpis.OrdersCancelledToday.GetValueOrDefault(s.Id),
            kpis.RevenueTodayPkr.GetValueOrDefault(s.Id))).ToList());
    }

    public async Task<Result<ShopDto>> GetByIdAsync(Guid shopId, Guid userId)
    {
        var ownership = await VerifyShopOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure<ShopDto>(ownership.Error!);
        var shop = ownership.Value!;
        var (dayStartUtc, dayEndUtc) = GetMerchantDayRangeUtc(configuration);
        var kpis = await LoadShopKpisAsync(new List<Guid> { shop.Id }, dayStartUtc, dayEndUtc);
        return Result.Success(ToDto(
            shop,
            kpis.OrdersToday.GetValueOrDefault(shop.Id),
            kpis.OrdersCancelledToday.GetValueOrDefault(shop.Id),
            kpis.RevenueTodayPkr.GetValueOrDefault(shop.Id)));
    }

    public async Task<Result<ShopDto>> CreateAsync(Guid userId, CreateShopRequest request)
    {
        var merchant = await merchantRepo.GetByUserIdAsync(userId);
        if (merchant is null)
            return Result.Failure<ShopDto>("Merchant account not found.");

        var shop = new Shop
        {
            Id = Guid.NewGuid(),
            MerchantId = merchant.Id,
            Name = request.Name,
            Description = request.Description,
            ShopType = request.ShopType,
            Address = request.Address,
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            Tags = request.Tags ?? [],
            OpeningHours = request.OpeningHours,
            OpenStatusMode = request.OpenStatusMode ?? "auto",
        };

        await shopRepo.CreateAsync(shop);

        var defaultTiers = JsonSerializer.SerializeToDocument(new[]
        {
            new { max_distance = 200, fee = 20 },
            new { max_distance = 400, fee = 30 },
            new { max_distance = 600, fee = 40 },
            new { max_distance = 800, fee = 50 },
            new { max_distance = 1000, fee = 60 },
        });

        var deliveryLogic = new ShopDeliveryLogic
        {
            Id = Guid.NewGuid(),
            ShopId = shop.Id,
            MinimumOrderValue = 200,
            SmallOrderSurcharge = 40,
            LeastOrderValue = 100,
            DistanceMode = "auto",
            MaxDeliveryFee = 130,
            DistanceTiers = defaultTiers,
            BeyondTierFeePerUnit = 10,
            BeyondTierDistanceUnit = 250,
            FreeDeliveryThreshold = 800,
            FreeDeliveryRadius = 1000,
        };

        await deliveryLogicRepo.CreateAsync(deliveryLogic);
        logger.LogInformation("Shop {ShopId} created with default delivery logic", shop.Id);

        return Result.Success(ToDto(shop, 0, 0, 0));
    }

    public async Task<Result<ShopDto>> UpdateAsync(Guid shopId, Guid userId, UpdateShopRequest request)
    {
        var ownership = await VerifyShopOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure<ShopDto>(ownership.Error!);

        var shop = ownership.Value!;
        if (request.Name is not null) shop.Name = request.Name;
        if (request.Description is not null) shop.Description = request.Description;
        if (request.Address is not null) shop.Address = request.Address;
        if (request.Latitude.HasValue) shop.Latitude = request.Latitude.Value;
        if (request.Longitude.HasValue) shop.Longitude = request.Longitude.Value;
        if (request.Tags is not null) shop.Tags = request.Tags;
        if (request.OpeningHours is not null) shop.OpeningHours = request.OpeningHours;
        if (request.OpenStatusMode is not null) shop.OpenStatusMode = request.OpenStatusMode;
        if (request.IsOpen.HasValue) shop.IsOpen = request.IsOpen.Value;
        shop.UpdatedAt = DateTimeOffset.UtcNow;

        await shopRepo.UpdateAsync(shop);
        var (dayStartUtc, dayEndUtc) = GetMerchantDayRangeUtc(configuration);
        var kpis = await LoadShopKpisAsync(new List<Guid> { shop.Id }, dayStartUtc, dayEndUtc);
        return Result.Success(ToDto(
            shop,
            kpis.OrdersToday.GetValueOrDefault(shop.Id),
            kpis.OrdersCancelledToday.GetValueOrDefault(shop.Id),
            kpis.RevenueTodayPkr.GetValueOrDefault(shop.Id)));
    }

    public async Task<Result> UpdateImageAsync(Guid shopId, Guid userId, string imageUrl)
    {
        var ownership = await VerifyShopOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure(ownership.Error!);

        var shop = ownership.Value!;
        shop.ImageUrl = imageUrl;
        shop.UpdatedAt = DateTimeOffset.UtcNow;
        await shopRepo.UpdateAsync(shop);
        logger.LogInformation("Shop {ShopId} image updated: {Url}", shopId, imageUrl);
        return Result.Success();
    }

    public async Task<Result> DeleteAsync(Guid shopId, Guid userId)
    {
        var ownership = await VerifyShopOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure(ownership.Error!);

        await shopRepo.DeleteAsync(ownership.Value!);
        return Result.Success();
    }

    private async Task<Result<Shop>> VerifyShopOwnershipAsync(Guid shopId, Guid userId)
    {
        var merchant = await merchantRepo.GetByUserIdAsync(userId);
        if (merchant is null)
            return Result.Failure<Shop>("Merchant account not found.");

        var shop = await shopRepo.GetByIdAsync(shopId);
        if (shop is null)
            return Result.Failure<Shop>("Shop not found.");

        if (shop.MerchantId != merchant.Id)
            return Result.Failure<Shop>("Access denied.");

        return Result.Success(shop);
    }

    private static ShopDto ToDto(Shop s, int ordersToday, int ordersCancelledToday, int revenueTodayPkr) => new(
        s.Id, s.MerchantId, s.Name, s.Description, s.ShopType,
        s.Address, s.Latitude, s.Longitude, s.ImageUrl,
        s.Tags, s.IsOpen, s.OpenStatusMode, s.OpeningHours,
        s.CreatedAt, s.UpdatedAt,
        ordersToday, ordersCancelledToday, revenueTodayPkr);

    private static (DateTimeOffset StartUtc, DateTimeOffset EndUtc) GetMerchantDayRangeUtc(IConfiguration configuration)
    {
        var tzId = configuration["App:MerchantStatsTimeZoneId"] ?? "Asia/Karachi";
        TimeZoneInfo tz;
        try
        {
            tz = TimeZoneInfo.FindSystemTimeZoneById(tzId);
        }
        catch
        {
            tz = TimeZoneInfo.Utc;
        }

        var utcNow = DateTime.UtcNow;
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(utcNow, tz);
        var localMidnight = new DateTime(localNow.Year, localNow.Month, localNow.Day, 0, 0, 0, DateTimeKind.Unspecified);
        var startUtc = TimeZoneInfo.ConvertTimeToUtc(localMidnight, tz);
        var endUtc = startUtc.AddDays(1);
        return (new DateTimeOffset(startUtc, TimeSpan.Zero), new DateTimeOffset(endUtc, TimeSpan.Zero));
    }

    private sealed record ShopKpis(
        Dictionary<Guid, int> OrdersToday,
        Dictionary<Guid, int> OrdersCancelledToday,
        Dictionary<Guid, int> RevenueTodayPkr);

    private async Task<ShopKpis> LoadShopKpisAsync(List<Guid> shopIds, DateTimeOffset dayStartUtc, DateTimeOffset dayEndUtc)
    {
        if (shopIds.Count == 0)
            return new ShopKpis(new Dictionary<Guid, int>(), new Dictionary<Guid, int>(), new Dictionary<Guid, int>());

        var placedRows = await db.Orders.AsNoTracking()
            .Where(o => o.ShopId != null && shopIds.Contains(o.ShopId.Value)
                && o.PlacedAt >= dayStartUtc && o.PlacedAt < dayEndUtc)
            .GroupBy(o => o.ShopId!.Value)
            .Select(g => new { ShopId = g.Key, Count = g.Count() })
            .ToListAsync();

        var cancelledRows = await db.Orders.AsNoTracking()
            .Where(o => o.ShopId != null && shopIds.Contains(o.ShopId.Value)
                && o.Status == "cancelled"
                && o.CancelledAt != null
                && o.CancelledAt >= dayStartUtc && o.CancelledAt < dayEndUtc)
            .GroupBy(o => o.ShopId!.Value)
            .Select(g => new { ShopId = g.Key, Count = g.Count() })
            .ToListAsync();

        var revenueRows = await db.Orders.AsNoTracking()
            .Where(o => o.ShopId != null && shopIds.Contains(o.ShopId.Value)
                && o.Status == "delivered"
                && o.DeliveredAt != null
                && o.DeliveredAt >= dayStartUtc && o.DeliveredAt < dayEndUtc)
            .GroupBy(o => o.ShopId!.Value)
            .Select(g => new { ShopId = g.Key, TotalCents = g.Sum(x => (long)x.TotalCents) })
            .ToListAsync();

        return new ShopKpis(
            placedRows.ToDictionary(x => x.ShopId, x => x.Count),
            cancelledRows.ToDictionary(x => x.ShopId, x => x.Count),
            revenueRows.ToDictionary(x => x.ShopId, x => (int)Math.Round(x.TotalCents / 100.0)));
    }
}
