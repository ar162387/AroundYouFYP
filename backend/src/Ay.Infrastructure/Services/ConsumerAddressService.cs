using Ay.Application.Consumer.DTOs;
using Ay.Application.Consumer.Services;
using Ay.Domain.Common;
using Ay.Domain.Entities;
using Ay.Domain.Interfaces;

namespace Ay.Infrastructure.Services;

public class ConsumerAddressService(IConsumerAddressRepository addressRepo) : IConsumerAddressService
{
    public async Task<Result<List<ConsumerAddressDto>>> GetAddressesAsync(Guid userId)
    {
        var addresses = await addressRepo.GetByUserIdAsync(userId);
        return Result.Success(addresses.Select(ToDto).ToList());
    }

    public async Task<Result<ConsumerAddressDto>> GetAddressByIdAsync(Guid addressId, Guid userId)
    {
        var addr = await addressRepo.GetByIdAsync(addressId);
        if (addr is null || addr.UserId != userId) return Result.Failure<ConsumerAddressDto>("Address not found.");
        return Result.Success(ToDto(addr));
    }

    public async Task<Result<ConsumerAddressDto>> CreateAddressAsync(Guid userId, CreateAddressRequest request)
    {
        var addr = new ConsumerAddress
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Title = request.Title,
            StreetAddress = request.StreetAddress,
            City = request.City,
            Region = request.Region,
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            Landmark = request.Landmark,
            FormattedAddress = request.FormattedAddress,
        };
        await addressRepo.CreateAsync(addr);
        return Result.Success(ToDto(addr));
    }

    public async Task<Result<ConsumerAddressDto>> UpdateAddressAsync(Guid addressId, Guid userId, UpdateAddressRequest request)
    {
        var addr = await addressRepo.GetByIdAsync(addressId);
        if (addr is null || addr.UserId != userId) return Result.Failure<ConsumerAddressDto>("Address not found.");
        if (request.Title is not null) addr.Title = request.Title;
        if (request.StreetAddress is not null) addr.StreetAddress = request.StreetAddress;
        if (request.City is not null) addr.City = request.City;
        if (request.Region is not null) addr.Region = request.Region;
        if (request.Latitude.HasValue) addr.Latitude = request.Latitude.Value;
        if (request.Longitude.HasValue) addr.Longitude = request.Longitude.Value;
        if (request.Landmark is not null) addr.Landmark = request.Landmark;
        if (request.FormattedAddress is not null) addr.FormattedAddress = request.FormattedAddress;
        addr.UpdatedAt = DateTimeOffset.UtcNow;
        await addressRepo.UpdateAsync(addr);
        return Result.Success(ToDto(addr));
    }

    public async Task<Result> DeleteAddressAsync(Guid addressId, Guid userId)
    {
        var addr = await addressRepo.GetByIdAsync(addressId);
        if (addr is null || addr.UserId != userId) return Result.Failure("Address not found.");
        await addressRepo.DeleteAsync(addr);
        return Result.Success();
    }

    private static ConsumerAddressDto ToDto(ConsumerAddress a) => new(a.Id, a.Title, a.StreetAddress, a.City, a.Region, a.Latitude, a.Longitude, a.Landmark, a.FormattedAddress, a.CreatedAt);
}
