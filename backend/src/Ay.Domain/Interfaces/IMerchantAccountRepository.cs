using Ay.Domain.Entities;

namespace Ay.Domain.Interfaces;

public interface IMerchantAccountRepository
{
    Task<MerchantAccount?> GetByUserIdAsync(Guid userId);
    Task<MerchantAccount?> GetByIdAsync(Guid id);
    Task<MerchantAccount> CreateAsync(MerchantAccount account);
    Task<MerchantAccount> UpdateAsync(MerchantAccount account);
    Task DeleteAsync(MerchantAccount account);

    /// <summary>Merchant accounts that have submitted a CNIC (identity verification payload).</summary>
    Task<List<MerchantAccount>> ListWithSubmittedVerificationAsync();
}
