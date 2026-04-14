using Ay.Domain.Entities;
using Ay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Ay.Infrastructure.Persistence.Repositories;

public class DeviceTokenRepository(AppDbContext context) : IDeviceTokenRepository
{
    public async Task<List<DeviceToken>> GetByUserIdAsync(Guid userId)
        => await context.DeviceTokens.Where(d => d.UserId == userId).ToListAsync();

    public async Task UpsertAsync(DeviceToken token)
    {
        var existing = await context.DeviceTokens.FirstOrDefaultAsync(d => d.Token == token.Token);
        if (existing is not null)
        {
            existing.UserId = token.UserId;
            existing.Platform = token.Platform;
            existing.UpdatedAt = DateTimeOffset.UtcNow;
        }
        else
        {
            context.DeviceTokens.Add(token);
        }
        await context.SaveChangesAsync();
    }

    public async Task DeleteByTokenAsync(string token)
    {
        var existing = await context.DeviceTokens.FirstOrDefaultAsync(d => d.Token == token);
        if (existing is not null)
        {
            context.DeviceTokens.Remove(existing);
            await context.SaveChangesAsync();
        }
    }

    public async Task DeleteAllForUserAsync(Guid userId)
    {
        var tokens = await context.DeviceTokens.Where(d => d.UserId == userId).ToListAsync();
        if (tokens.Count > 0)
        {
            context.DeviceTokens.RemoveRange(tokens);
            await context.SaveChangesAsync();
        }
    }
}
