using Ay.Domain.Entities;
using Ay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Ay.Infrastructure.Persistence.Repositories;

public class NotificationPreferenceRepository(AppDbContext context) : INotificationPreferenceRepository
{
    public async Task<NotificationPreference?> GetAsync(Guid userId, string role)
        => await context.Set<NotificationPreference>().FirstOrDefaultAsync(p => p.UserId == userId && p.Role == role);

    public async Task<NotificationPreference> UpsertAsync(NotificationPreference pref)
    {
        var existing = await GetAsync(pref.UserId, pref.Role);
        if (existing is not null)
        {
            existing.AllowPushNotifications = pref.AllowPushNotifications;
            existing.UpdatedAt = DateTimeOffset.UtcNow;
            context.Set<NotificationPreference>().Update(existing);
            await context.SaveChangesAsync();
            return existing;
        }
        pref.Id = Guid.NewGuid();
        context.Set<NotificationPreference>().Add(pref);
        await context.SaveChangesAsync();
        return pref;
    }
}
