namespace Ay.Application.Notifications;

/// <summary>
/// Sends FCM push notifications to all registered device tokens for a user,
/// honouring per-user notification preferences. Fire-and-forget safe: callers
/// do not need to await a success result — failures are logged and silently
/// swallowed so they never block order-flow operations.
/// </summary>
public interface INotificationService
{
    /// <summary>
    /// Send a push notification to a user. Checks notification preferences and
    /// iterates all device tokens, logging each send attempt.
    /// </summary>
    /// <param name="userId">Target user.</param>
    /// <param name="title">Notification title.</param>
    /// <param name="body">Notification body.</param>
    /// <param name="data">Optional key-value payload forwarded to the client app.</param>
    Task SendAsync(
        Guid userId,
        string title,
        string body,
        Dictionary<string, string>? data = null);
}
