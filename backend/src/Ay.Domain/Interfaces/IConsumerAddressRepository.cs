using Ay.Domain.Entities;

namespace Ay.Domain.Interfaces;

public interface IConsumerAddressRepository
{
    Task<List<ConsumerAddress>> GetByUserIdAsync(Guid userId);
    Task<ConsumerAddress?> GetByIdAsync(Guid id);
    Task<ConsumerAddress> CreateAsync(ConsumerAddress address);
    Task<ConsumerAddress> UpdateAsync(ConsumerAddress address);
    Task DeleteAsync(ConsumerAddress address);
}
