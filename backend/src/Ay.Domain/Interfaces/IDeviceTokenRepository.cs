using Ay.Domain.Entities;

namespace Ay.Domain.Interfaces;

public interface IDeviceTokenRepository
{
    Task<List<DeviceToken>> GetByUserIdAsync(Guid userId);
    Task UpsertAsync(DeviceToken token);
    Task DeleteByTokenAsync(string token);
    Task DeleteAllForUserAsync(Guid userId);
}
