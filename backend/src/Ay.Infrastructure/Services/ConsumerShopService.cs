using System.Text.Json;
using Ay.Application.Consumer.DTOs;
using Ay.Application.Consumer.Services;
using Ay.Domain.Common;
using Ay.Domain.Entities;
using Ay.Domain.Interfaces;
using Ay.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace Ay.Infrastructure.Services;

public class ConsumerShopService(
    AppDbContext context,
    IDeliveryFeeCalculatorService feeCalc,
    IReviewRepository reviewRepo) : IConsumerShopService
{
    private static readonly GeometryFactory GeomFactory = new(new PrecisionModel(), 4326);

    public async Task<Result<List<ConsumerShopDto>>> FindByLocationAsync(
        double latitude, double longitude, double radiusMeters = 5000,
        string? shopType = null, int page = 1, int pageSize = 20)
    {
        var consumerPoint = CreateConsumerPoint(latitude, longitude);

        var query = context.Shops
            .Include(s => s.MerchantAccount)
            .Include(s => s.DeliveryLogic)
            .Where(s =>
                s.MerchantAccount != null &&
                s.MerchantAccount.Status == "verified" &&
                context.ShopDeliveryAreas.Any(a => a.ShopId == s.Id && a.Geom.Contains(consumerPoint)))
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(shopType))
            query = query.Where(s => s.ShopType == shopType);

        var allShops = await query.ToListAsync();

        var enriched = new List<ConsumerShopDto>();
        foreach (var s in allShops)
        {
            if (!ShopOpenStatusHelper.IsOpenNow(s))
                continue;

            var dist = feeCalc.CalculateDistance(latitude, longitude, s.Latitude, s.Longitude);
            if (dist > radiusMeters) continue;

            decimal deliveryFee = 0;
            decimal? minOrder = null;
            if (s.DeliveryLogic is not null)
            {
                var breakdown = feeCalc.CalculateFee(0, dist, s.DeliveryLogic);
                deliveryFee = breakdown.DeliveryFeeCents / 100m;
                minOrder = s.DeliveryLogic.MinimumOrderValue;
            }

            var isOpen = ShopOpenStatusHelper.IsOpenNow(s);
            var (rating, count) = await reviewRepo.GetShopRatingAsync(s.Id);

            enriched.Add(new ConsumerShopDto(
                s.Id, s.Name, s.Description, s.ShopType, s.Address,
                s.Latitude, s.Longitude, s.ImageUrl, s.Tags,
                isOpen, Math.Round(dist, 1), deliveryFee, minOrder,
                count > 0 ? Math.Round(rating, 1) : null, count, s.CreatedAt));
        }

        var result = enriched.OrderBy(s => s.DistanceMeters).Skip((page - 1) * pageSize).Take(pageSize).ToList();
        return Result.Success(result);
    }

    public async Task<Result<ShopDetailDto>> GetShopDetailAsync(Guid shopId, double? consumerLat, double? consumerLon)
    {
        var shop = await context.Shops
            .Include(s => s.MerchantAccount)
            .Include(s => s.DeliveryLogic)
            .Include(s => s.Categories.Where(c => c.IsActive))
                .ThenInclude(c => c.ItemCategories)
                    .ThenInclude(ic => ic.MerchantItem)
            .FirstOrDefaultAsync(s => s.Id == shopId);

        if (shop is null) return Result.Failure<ShopDetailDto>("Shop not found.");

        if (shop.MerchantAccount is null || shop.MerchantAccount.Status != "verified")
            return Result.Failure<ShopDetailDto>("Shop not found.");

        if (!ShopOpenStatusHelper.IsOpenNow(shop))
            return Result.Failure<ShopDetailDto>("Shop not found.");

        if (consumerLat.HasValue && consumerLon.HasValue)
        {
            var isInDeliveryArea = await IsWithinDeliveryAreaAsync(shop.Id, consumerLat.Value, consumerLon.Value);
            if (!isInDeliveryArea) return Result.Failure<ShopDetailDto>("Shop not found.");
        }

        double dist = 0;
        decimal deliveryFee = 0;
        decimal? minOrder = shop.DeliveryLogic?.MinimumOrderValue;

        if (consumerLat.HasValue && consumerLon.HasValue)
        {
            dist = feeCalc.CalculateDistance(consumerLat.Value, consumerLon.Value, shop.Latitude, shop.Longitude);
            if (shop.DeliveryLogic is not null)
            {
                var breakdown = feeCalc.CalculateFee(0, dist, shop.DeliveryLogic);
                deliveryFee = breakdown.DeliveryFeeCents / 100m;
            }
        }

        var isOpen = ShopOpenStatusHelper.IsOpenNow(shop);
        var (rating, count) = await reviewRepo.GetShopRatingAsync(shop.Id);

        var categories = shop.Categories.Select(c => new ConsumerCategoryDto(
            c.Id, c.Name,
            c.ItemCategories
                .Where(ic => ic.MerchantItem != null && ic.MerchantItem.IsActive)
                .OrderBy(ic => ic.SortOrder).ThenBy(ic => ic.MerchantItem!.Name)
                .Select(ic => new ConsumerItemDto(
                    ic.MerchantItem!.Id, ic.MerchantItem.Name, ic.MerchantItem.Description,
                    ic.MerchantItem.PriceCents, ic.MerchantItem.Currency,
                    ic.MerchantItem.ImageUrl, ic.MerchantItem.IsActive, ic.MerchantItem.TimesSold))
                .ToArray()
        )).ToArray();

        return Result.Success(new ShopDetailDto(
            shop.Id, shop.Name, shop.Description, shop.ShopType, shop.Address,
            shop.Latitude, shop.Longitude, shop.ImageUrl, shop.Tags,
            isOpen, Math.Round(dist, 1), deliveryFee, minOrder,
            count > 0 ? Math.Round(rating, 1) : null, count, categories, shop.CreatedAt,
            MapConsumerDeliveryLogic(shop.DeliveryLogic)));
    }

    private static ConsumerDeliveryLogicDto? MapConsumerDeliveryLogic(ShopDeliveryLogic? d)
    {
        if (d is null) return null;

        var tiers = Array.Empty<ConsumerDistanceTierDto>();
        if (d.DistanceTiers is not null)
        {
            try
            {
                tiers = d.DistanceTiers.RootElement.EnumerateArray()
                    .Select(e => new ConsumerDistanceTierDto(
                        e.GetProperty("max_distance").GetDecimal(),
                        e.GetProperty("fee").GetDecimal()))
                    .ToArray();
            }
            catch
            {
                tiers = Array.Empty<ConsumerDistanceTierDto>();
            }
        }

        return new ConsumerDeliveryLogicDto(
            d.Id,
            d.ShopId,
            d.MinimumOrderValue,
            d.SmallOrderSurcharge,
            d.LeastOrderValue,
            d.DistanceMode,
            d.MaxDeliveryFee,
            tiers,
            d.BeyondTierFeePerUnit,
            d.BeyondTierDistanceUnit,
            d.FreeDeliveryThreshold,
            d.FreeDeliveryRadius,
            d.CreatedAt,
            d.UpdatedAt);
    }

    private async Task<bool> IsWithinDeliveryAreaAsync(Guid shopId, double latitude, double longitude)
    {
        var consumerPoint = CreateConsumerPoint(latitude, longitude);
        return await context.ShopDeliveryAreas
            .AnyAsync(a => a.ShopId == shopId && a.Geom.Contains(consumerPoint));
    }

    private static Point CreateConsumerPoint(double latitude, double longitude)
    {
        var point = GeomFactory.CreatePoint(new Coordinate(longitude, latitude));
        point.SRID = 4326;
        return point;
    }
}
