using Ay.Domain.Entities;

namespace Ay.Domain.Interfaces;

public interface IUserProfileRepository
{
    Task<UserProfile?> GetByUserIdAsync(Guid userId);
    Task<UserProfile> CreateAsync(UserProfile profile);
    Task<UserProfile> UpdateAsync(UserProfile profile);
    Task DeleteByUserIdAsync(Guid userId);
}
