using Ay.Application.Consumer.DTOs;
using Ay.Domain.Common;

namespace Ay.Application.Consumer.Services;

public interface IConsumerAddressService
{
    Task<Result<List<ConsumerAddressDto>>> GetAddressesAsync(Guid userId);
    Task<Result<ConsumerAddressDto>> GetAddressByIdAsync(Guid addressId, Guid userId);
    Task<Result<ConsumerAddressDto>> CreateAddressAsync(Guid userId, CreateAddressRequest request);
    Task<Result<ConsumerAddressDto>> UpdateAddressAsync(Guid addressId, Guid userId, UpdateAddressRequest request);
    Task<Result> DeleteAddressAsync(Guid addressId, Guid userId);
}
