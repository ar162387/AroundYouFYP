using Ay.Application.Merchant.DTOs;
using Ay.Application.Merchant.Services;
using Ay.Domain.Common;
using Ay.Domain.Entities;
using Ay.Domain.Interfaces;
using Ay.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace Ay.Infrastructure.Services;

public class DeliveryAreaService(
    AppDbContext context,
    IMerchantAccountRepository merchantRepo,
    IShopRepository shopRepo) : IDeliveryAreaService
{
    private static readonly GeometryFactory GeomFactory = new(new PrecisionModel(), 4326);

    public async Task<Result<List<DeliveryAreaDto>>> GetAreasAsync(Guid shopId, Guid userId)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure<List<DeliveryAreaDto>>(ownership.Error!);

        var areas = await context.ShopDeliveryAreas
            .Where(a => a.ShopId == shopId)
            .ToListAsync();

        return Result.Success(areas.Select(ToDto).ToList());
    }

    public async Task<Result<DeliveryAreaDto>> CreateAreaAsync(Guid shopId, Guid userId, CreateDeliveryAreaRequest request)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure<DeliveryAreaDto>(ownership.Error!);

        if (request.Coordinates is not { Length: >= 4 })
            return Result.Failure<DeliveryAreaDto>("A polygon requires at least 4 coordinates (first == last to close the ring).");

        var ring = request.Coordinates
            .Select(c => new Coordinate(c.Longitude, c.Latitude))
            .ToArray();

        // Ensure the ring is closed
        if (!ring[0].Equals2D(ring[^1]))
            ring = [.. ring, ring[0]];

        Polygon polygon;
        try
        {
            polygon = GeomFactory.CreatePolygon(GeomFactory.CreateLinearRing(ring));
        }
        catch (Exception ex)
        {
            return Result.Failure<DeliveryAreaDto>($"Invalid polygon geometry: {ex.Message}");
        }

        var area = new ShopDeliveryArea
        {
            Id = Guid.NewGuid(),
            ShopId = shopId,
            Label = request.Label,
            Geom = polygon,
        };

        context.ShopDeliveryAreas.Add(area);
        await context.SaveChangesAsync();

        return Result.Success(ToDto(area));
    }

    public async Task<Result> DeleteAreaAsync(Guid shopId, Guid areaId, Guid userId)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure(ownership.Error!);

        var area = await context.ShopDeliveryAreas
            .FirstOrDefaultAsync(a => a.Id == areaId && a.ShopId == shopId);
        if (area is null) return Result.Failure("Delivery area not found.");

        context.ShopDeliveryAreas.Remove(area);
        await context.SaveChangesAsync();
        return Result.Success();
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

    private static DeliveryAreaDto ToDto(ShopDeliveryArea a)
    {
        var coords = Array.Empty<CoordinateDto>();
        if (a.Geom is Polygon p && p.ExteriorRing is not null)
        {
            coords = p.ExteriorRing.Coordinates
                .Select(c => new CoordinateDto(c.X, c.Y))
                .ToArray();
        }
        return new DeliveryAreaDto(a.Id, a.ShopId, a.Label, coords, a.CreatedAt, a.UpdatedAt);
    }
}
