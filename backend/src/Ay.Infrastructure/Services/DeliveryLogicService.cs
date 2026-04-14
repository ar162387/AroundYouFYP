using System.Text.Json;
using Ay.Application.Merchant.DTOs;
using Ay.Application.Merchant.Services;
using Ay.Domain.Common;
using Ay.Domain.Entities;
using Ay.Domain.Interfaces;

namespace Ay.Infrastructure.Services;

public class DeliveryLogicService(
    IDeliveryLogicRepository deliveryLogicRepo,
    IMerchantAccountRepository merchantRepo,
    IShopRepository shopRepo) : IDeliveryLogicService
{
    public async Task<Result<DeliveryLogicDto>> GetByShopIdAsync(Guid shopId, Guid userId)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure<DeliveryLogicDto>(ownership.Error!);

        var logic = await deliveryLogicRepo.GetByShopIdAsync(shopId);
        if (logic is null)
            return Result.Failure<DeliveryLogicDto>("Delivery logic not found.");

        return Result.Success(ToDto(logic));
    }

    public async Task<Result<DeliveryLogicDto>> UpsertAsync(Guid shopId, Guid userId, UpdateDeliveryLogicRequest request)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure<DeliveryLogicDto>(ownership.Error!);

        var logic = await deliveryLogicRepo.GetByShopIdAsync(shopId);
        if (logic is null)
            return Result.Failure<DeliveryLogicDto>("Delivery logic not found.");

        logic.MinimumOrderValue = request.MinimumOrderValue;
        logic.SmallOrderSurcharge = request.SmallOrderSurcharge;
        logic.LeastOrderValue = request.LeastOrderValue;
        if (request.DistanceMode is not null) logic.DistanceMode = request.DistanceMode;
        if (request.MaxDeliveryFee.HasValue) logic.MaxDeliveryFee = request.MaxDeliveryFee.Value;
        if (request.DistanceTiers is not null)
        {
            var tiers = request.DistanceTiers.Select(t => new { max_distance = t.MaxDistance, fee = t.Fee });
            logic.DistanceTiers = JsonSerializer.SerializeToDocument(tiers);
        }
        if (request.BeyondTierFeePerUnit.HasValue) logic.BeyondTierFeePerUnit = request.BeyondTierFeePerUnit.Value;
        if (request.BeyondTierDistanceUnit.HasValue) logic.BeyondTierDistanceUnit = request.BeyondTierDistanceUnit.Value;
        if (request.FreeDeliveryThreshold.HasValue) logic.FreeDeliveryThreshold = request.FreeDeliveryThreshold.Value;
        if (request.FreeDeliveryRadius.HasValue) logic.FreeDeliveryRadius = request.FreeDeliveryRadius.Value;
        logic.UpdatedAt = DateTimeOffset.UtcNow;

        await deliveryLogicRepo.UpdateAsync(logic);
        return Result.Success(ToDto(logic));
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

    private static DeliveryLogicDto ToDto(ShopDeliveryLogic d)
    {
        var tiers = Array.Empty<DistanceTierDto>();
        if (d.DistanceTiers is not null)
        {
            try
            {
                tiers = d.DistanceTiers.RootElement.EnumerateArray()
                    .Select(e => new DistanceTierDto(
                        e.GetProperty("max_distance").GetDecimal(),
                        e.GetProperty("fee").GetDecimal()))
                    .ToArray();
            }
            catch { }
        }

        return new DeliveryLogicDto(
            d.Id, d.ShopId, d.MinimumOrderValue, d.SmallOrderSurcharge, d.LeastOrderValue,
            d.DistanceMode, d.MaxDeliveryFee, tiers,
            d.BeyondTierFeePerUnit, d.BeyondTierDistanceUnit,
            d.FreeDeliveryThreshold, d.FreeDeliveryRadius,
            d.CreatedAt, d.UpdatedAt);
    }
}
