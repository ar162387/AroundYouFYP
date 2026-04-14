using Ay.Domain.Enums;

namespace Ay.Domain.Entities;

public class UserProfile
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string? Email { get; set; }
    public string? Name { get; set; }
    public UserRole Role { get; set; } = UserRole.Consumer;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
