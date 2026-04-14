using Ay.Application.Consumer.DTOs;
using Ay.Application.Consumer.Services;
using Ay.Domain.Common;
using Ay.Domain.Interfaces;

namespace Ay.Infrastructure.Services;

public class ConsumerProfileService(IUserProfileRepository profileRepo) : IConsumerProfileService
{
    public async Task<Result<ConsumerProfileDto>> GetProfileAsync(Guid userId)
    {
        var profile = await profileRepo.GetByUserIdAsync(userId);
        if (profile is null) return Result.Failure<ConsumerProfileDto>("Profile not found.");
        return Result.Success(new ConsumerProfileDto(profile.Id, profile.Email, profile.Name, profile.Role.ToString().ToLower(), profile.CreatedAt));
    }

    public async Task<Result<ConsumerProfileDto>> UpdateProfileAsync(Guid userId, UpdateConsumerProfileRequest request)
    {
        var profile = await profileRepo.GetByUserIdAsync(userId);
        if (profile is null) return Result.Failure<ConsumerProfileDto>("Profile not found.");
        if (request.Name is not null) profile.Name = request.Name;
        profile.UpdatedAt = DateTimeOffset.UtcNow;
        await profileRepo.UpdateAsync(profile);
        return Result.Success(new ConsumerProfileDto(profile.Id, profile.Email, profile.Name, profile.Role.ToString().ToLower(), profile.CreatedAt));
    }
}
