using Ay.Application.Merchant.DTOs;
using Ay.Domain.Common;

namespace Ay.Application.Merchant.Services;

public interface IMerchantVerificationAdminService
{
    Task<Result<List<MerchantVerificationIdentityDto>>> ListSubmittedIdentitiesAsync();

    /// <summary>Marks the merchant as verified (CNIC submission accepted).</summary>
    Task<Result> ApproveAsync(Guid merchantId);

    /// <summary>Clears submitted identity fields and sets status to none (merchant must resubmit).</summary>
    Task<Result> RejectAsync(Guid merchantId);
}
