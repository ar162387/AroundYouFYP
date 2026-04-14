namespace Ay.Domain.Entities;

public class NotificationPreference
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Role { get; set; } = "consumer";
    public bool AllowPushNotifications { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
