using Ay.Application.Consumer.DTOs;
using Ay.Domain.Common;

namespace Ay.Application.Consumer.Services;

public interface IConsumerProfileService
{
    Task<Result<ConsumerProfileDto>> GetProfileAsync(Guid userId);
    Task<Result<ConsumerProfileDto>> UpdateProfileAsync(Guid userId, UpdateConsumerProfileRequest request);
}
