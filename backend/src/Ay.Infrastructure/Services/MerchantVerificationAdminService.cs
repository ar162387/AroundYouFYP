using Ay.Application.Merchant.DTOs;
using Ay.Application.Merchant.Services;
using Ay.Domain.Common;
using Ay.Domain.Interfaces;

namespace Ay.Infrastructure.Services;

public class MerchantVerificationAdminService(
    IMerchantAccountRepository merchantRepo,
    IUserProfileRepository profileRepo) : IMerchantVerificationAdminService
{
    public async Task<Result<List<MerchantVerificationIdentityDto>>> ListSubmittedIdentitiesAsync()
    {
        var accounts = await merchantRepo.ListWithSubmittedVerificationAsync();
        if (accounts.Count == 0)
            return Result.Success(new List<MerchantVerificationIdentityDto>());

        var profiles = await Task.WhenAll(accounts.Select(a => profileRepo.GetByUserIdAsync(a.UserId)));

        var list = new List<MerchantVerificationIdentityDto>(accounts.Count);
        for (var i = 0; i < accounts.Count; i++)
        {
            var a = accounts[i];
            var p = profiles[i];
            list.Add(new MerchantVerificationIdentityDto(
                a.Id,
                a.UserId,
                p?.Email,
                p?.Name,
                a.Status,
                a.NameAsPerCnic,
                a.Cnic,
                a.CnicExpiry,
                a.UpdatedAt));
        }

        return Result.Success(list);
    }

    public async Task<Result> ApproveAsync(Guid merchantId)
    {
        var account = await merchantRepo.GetByIdAsync(merchantId);
        if (account is null)
            return Result.Failure("Merchant account not found.");

        if (account.Status == "verified")
            return Result.Success();

        var awaitingReview = account.Status == "pending"
            || (account.Status == "none" && !string.IsNullOrWhiteSpace(account.Cnic));
        if (!awaitingReview)
            return Result.Failure("Merchant is not awaiting verification (must be pending or have submitted identity).");

        account.Status = "verified";
        account.UpdatedAt = DateTimeOffset.UtcNow;
        await merchantRepo.UpdateAsync(account);
        return Result.Success();
    }

    public async Task<Result> RejectAsync(Guid merchantId)
    {
        var account = await merchantRepo.GetByIdAsync(merchantId);
        if (account is null)
            return Result.Failure("Merchant account not found.");

        if (account.Status == "none" && string.IsNullOrWhiteSpace(account.Cnic))
            return Result.Failure("Nothing to reject for this merchant account.");

        account.Status = "none";
        account.NameAsPerCnic = null;
        account.Cnic = null;
        account.CnicExpiry = null;
        account.UpdatedAt = DateTimeOffset.UtcNow;
        await merchantRepo.UpdateAsync(account);
        return Result.Success();
    }
}
