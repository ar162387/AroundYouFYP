using Ay.Domain.Entities;

namespace Ay.Application.Auth.Services;

public interface IJwtTokenGenerator
{
    (string Token, DateTimeOffset ExpiresAt) GenerateToken(Guid userId, string email, string? name, string role);
}
