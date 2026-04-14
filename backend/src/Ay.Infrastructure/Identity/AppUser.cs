using Microsoft.AspNetCore.Identity;

namespace Ay.Infrastructure.Identity;

public class AppUser : IdentityUser<Guid>
{
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
