using Ay.Application.Merchant.DTOs;
using Ay.Domain.Common;

namespace Ay.Application.Merchant.Services;

public interface IMerchantAccountService
{
    Task<Result<MerchantAccountDto>> GetByUserIdAsync(Guid userId);
    Task<Result<MerchantAccountCreatedResponse>> CreateAsync(Guid userId, CreateMerchantAccountRequest request);
    Task<Result<MerchantAccountDto>> UpdateAsync(Guid userId, UpdateMerchantAccountRequest request);
    Task<Result> DeleteAsync(Guid userId);
}
