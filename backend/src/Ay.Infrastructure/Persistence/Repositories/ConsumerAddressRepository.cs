using Ay.Domain.Entities;
using Ay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Ay.Infrastructure.Persistence.Repositories;

public class ConsumerAddressRepository(AppDbContext context) : IConsumerAddressRepository
{
    public async Task<List<ConsumerAddress>> GetByUserIdAsync(Guid userId)
        => await context.ConsumerAddresses.Where(a => a.UserId == userId).OrderByDescending(a => a.CreatedAt).ToListAsync();

    public async Task<ConsumerAddress?> GetByIdAsync(Guid id)
        => await context.ConsumerAddresses.FindAsync(id);

    public async Task<ConsumerAddress> CreateAsync(ConsumerAddress address)
    {
        context.ConsumerAddresses.Add(address);
        await context.SaveChangesAsync();
        return address;
    }

    public async Task<ConsumerAddress> UpdateAsync(ConsumerAddress address)
    {
        context.ConsumerAddresses.Update(address);
        await context.SaveChangesAsync();
        return address;
    }

    public async Task DeleteAsync(ConsumerAddress address)
    {
        context.ConsumerAddresses.Remove(address);
        await context.SaveChangesAsync();
    }
}
