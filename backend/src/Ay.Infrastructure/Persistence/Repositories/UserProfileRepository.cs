using Ay.Domain.Entities;
using Ay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Ay.Infrastructure.Persistence.Repositories;

public class UserProfileRepository(AppDbContext context) : IUserProfileRepository
{
    public async Task<UserProfile?> GetByUserIdAsync(Guid userId)
        => await context.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);

    public async Task<UserProfile> CreateAsync(UserProfile profile)
    {
        context.UserProfiles.Add(profile);
        await context.SaveChangesAsync();
        return profile;
    }

    public async Task<UserProfile> UpdateAsync(UserProfile profile)
    {
        context.UserProfiles.Update(profile);
        await context.SaveChangesAsync();
        return profile;
    }

    public async Task DeleteByUserIdAsync(Guid userId)
    {
        var profile = await context.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
        if (profile is not null)
        {
            context.UserProfiles.Remove(profile);
            await context.SaveChangesAsync();
        }
    }
}
