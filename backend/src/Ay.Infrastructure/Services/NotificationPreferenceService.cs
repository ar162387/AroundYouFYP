using Ay.Application.Consumer.DTOs;
using Ay.Application.Consumer.Services;
using Ay.Domain.Common;
using Ay.Domain.Entities;
using Ay.Domain.Interfaces;

namespace Ay.Infrastructure.Services;

public class NotificationPreferenceService(INotificationPreferenceRepository prefRepo) : INotificationPreferenceService
{
    public async Task<Result<NotificationPreferenceDto>> GetAsync(Guid userId, string role)
    {
        var pref = await prefRepo.GetAsync(userId, role);
        if (pref is null)
        {
            pref = await prefRepo.UpsertAsync(new NotificationPreference { UserId = userId, Role = role, AllowPushNotifications = true });
        }
        return Result.Success(new NotificationPreferenceDto(pref.Id, pref.UserId, pref.Role, pref.AllowPushNotifications));
    }

    public async Task<Result<NotificationPreferenceDto>> UpsertAsync(Guid userId, string role, UpdateNotificationPreferenceRequest request)
    {
        var pref = await prefRepo.UpsertAsync(new NotificationPreference
        {
            UserId = userId,
            Role = role,
            AllowPushNotifications = request.AllowPushNotifications,
        });
        return Result.Success(new NotificationPreferenceDto(pref.Id, pref.UserId, pref.Role, pref.AllowPushNotifications));
    }
}
