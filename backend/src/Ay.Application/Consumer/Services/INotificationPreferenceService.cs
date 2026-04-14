using Ay.Application.Consumer.DTOs;
using Ay.Domain.Common;

namespace Ay.Application.Consumer.Services;

public interface INotificationPreferenceService
{
    Task<Result<NotificationPreferenceDto>> GetAsync(Guid userId, string role);
    Task<Result<NotificationPreferenceDto>> UpsertAsync(Guid userId, string role, UpdateNotificationPreferenceRequest request);
}
