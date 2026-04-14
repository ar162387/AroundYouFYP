using Ay.Application.Auth.DTOs;
using Ay.Domain.Common;
using Ay.Domain.Entities;
using Ay.Domain.Interfaces;

namespace Ay.Application.Auth.Services;

public class DeviceTokenService(IDeviceTokenRepository repo) : IDeviceTokenService
{
    public async Task<Result> RegisterTokenAsync(Guid userId, RegisterDeviceTokenRequest request)
    {
        var token = new DeviceToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Token = request.Token,
            Platform = request.Platform
        };
        await repo.UpsertAsync(token);
        return Result.Success();
    }

    public async Task<Result> RemoveTokenAsync(Guid userId, string token)
    {
        await repo.DeleteByTokenAsync(token);
        return Result.Success();
    }
}
