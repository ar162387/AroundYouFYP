using Ay.Domain.Entities;

namespace Ay.Domain.Interfaces;

public interface INotificationPreferenceRepository
{
    Task<NotificationPreference?> GetAsync(Guid userId, string role);
    Task<NotificationPreference> UpsertAsync(NotificationPreference pref);
}
