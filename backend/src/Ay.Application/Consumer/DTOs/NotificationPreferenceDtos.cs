namespace Ay.Application.Consumer.DTOs;

public record NotificationPreferenceDto(Guid Id, Guid UserId, string Role, bool AllowPushNotifications);
public record UpdateNotificationPreferenceRequest(bool AllowPushNotifications);
