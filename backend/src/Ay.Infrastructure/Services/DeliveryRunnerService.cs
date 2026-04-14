using Ay.Application.Merchant.DTOs;
using Ay.Application.Merchant.Services;
using Ay.Domain.Common;
using Ay.Domain.Entities;
using Ay.Domain.Interfaces;
using Ay.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Ay.Infrastructure.Services;

public class DeliveryRunnerService(
    IDeliveryRunnerRepository runnerRepo,
    IMerchantAccountRepository merchantRepo,
    IShopRepository shopRepo,
    AppDbContext context) : IDeliveryRunnerService
{
    public async Task<Result<List<DeliveryRunnerWithStatusDto>>> GetByShopIdAsync(Guid shopId, Guid userId)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure<List<DeliveryRunnerWithStatusDto>>(ownership.Error!);

        var runners = await runnerRepo.GetByShopIdAsync(shopId);
        var activeStatuses = new[] { "confirmed", "out_for_delivery" };
        var activeOrders = await context.Orders
            .Where(o => o.ShopId == shopId && activeStatuses.Contains(o.Status) && o.DeliveryRunnerId != null)
            .Select(o => new { o.DeliveryRunnerId, o.Id, o.OrderNumber })
            .ToListAsync();

        var result = runners.Select(r =>
        {
            var active = activeOrders.FirstOrDefault(o => o.DeliveryRunnerId == r.Id);
            return new DeliveryRunnerWithStatusDto(
                r.Id, r.ShopId, r.Name, r.PhoneNumber,
                active is null, active?.Id, active?.OrderNumber);
        }).ToList();

        return Result.Success(result);
    }

    public async Task<Result<DeliveryRunnerDto>> CreateAsync(Guid shopId, Guid userId, CreateRunnerRequest request)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure<DeliveryRunnerDto>(ownership.Error!);

        var runner = new DeliveryRunner
        {
            Id = Guid.NewGuid(),
            ShopId = shopId,
            Name = request.Name,
            PhoneNumber = request.PhoneNumber,
        };

        await runnerRepo.CreateAsync(runner);
        return Result.Success(new DeliveryRunnerDto(runner.Id, runner.ShopId, runner.Name, runner.PhoneNumber, runner.CreatedAt));
    }

    public async Task<Result<DeliveryRunnerDto>> UpdateAsync(Guid shopId, Guid runnerId, Guid userId, UpdateRunnerRequest request)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure<DeliveryRunnerDto>(ownership.Error!);

        var runner = await runnerRepo.GetByIdAsync(runnerId);
        if (runner is null || runner.ShopId != shopId)
            return Result.Failure<DeliveryRunnerDto>("Runner not found.");

        if (request.Name is not null) runner.Name = request.Name;
        if (request.PhoneNumber is not null) runner.PhoneNumber = request.PhoneNumber;
        runner.UpdatedAt = DateTimeOffset.UtcNow;

        await runnerRepo.UpdateAsync(runner);
        return Result.Success(new DeliveryRunnerDto(runner.Id, runner.ShopId, runner.Name, runner.PhoneNumber, runner.CreatedAt));
    }

    public async Task<Result> DeleteAsync(Guid shopId, Guid runnerId, Guid userId)
    {
        var ownership = await VerifyOwnershipAsync(shopId, userId);
        if (!ownership.IsSuccess) return Result.Failure(ownership.Error!);

        var runner = await runnerRepo.GetByIdAsync(runnerId);
        if (runner is null || runner.ShopId != shopId)
            return Result.Failure("Runner not found.");

        await runnerRepo.DeleteAsync(runner);
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
}
