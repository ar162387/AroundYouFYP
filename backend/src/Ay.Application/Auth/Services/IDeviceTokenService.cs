using Ay.Application.Auth.DTOs;
using Ay.Domain.Common;

namespace Ay.Application.Auth.Services;

public interface IDeviceTokenService
{
    Task<Result> RegisterTokenAsync(Guid userId, RegisterDeviceTokenRequest request);
    Task<Result> RemoveTokenAsync(Guid userId, string token);
}
