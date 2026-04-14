using Ay.Domain.Entities;
using Ay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Ay.Infrastructure.Persistence.Repositories;

public class MerchantAccountRepository(AppDbContext context) : IMerchantAccountRepository
{
    public async Task<MerchantAccount?> GetByUserIdAsync(Guid userId)
        => await context.MerchantAccounts.FirstOrDefaultAsync(m => m.UserId == userId);

    public async Task<MerchantAccount?> GetByIdAsync(Guid id)
        => await context.MerchantAccounts.FindAsync(id);

    public async Task<MerchantAccount> CreateAsync(MerchantAccount account)
    {
        context.MerchantAccounts.Add(account);
        await context.SaveChangesAsync();
        return account;
    }

    public async Task<MerchantAccount> UpdateAsync(MerchantAccount account)
    {
        context.MerchantAccounts.Update(account);
        await context.SaveChangesAsync();
        return account;
    }

    public async Task DeleteAsync(MerchantAccount account)
    {
        context.MerchantAccounts.Remove(account);
        await context.SaveChangesAsync();
    }

    public async Task<List<MerchantAccount>> ListWithSubmittedVerificationAsync()
        => await context.MerchantAccounts.AsNoTracking()
            .Where(m => m.Cnic != null && m.Cnic != "" && m.Status != "verified")
            .OrderByDescending(m => m.UpdatedAt)
            .ToListAsync();
}
