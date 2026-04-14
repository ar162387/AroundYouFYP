using Ay.Application.Merchant.DTOs;
using Ay.Application.Merchant.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ay.WebApi.Controllers.Merchant;

[ApiController]
[Route("api/v1/merchant/account")]
[Authorize]
public class MerchantAccountController(IMerchantAccountService accountService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAccount()
    {
        var result = await accountService.GetByUserIdAsync(MerchantHttp.GetUserId(User));
        return result.IsSuccess ? Ok(result.Value) : NotFound(MerchantHttp.AccountToProblem(result.Error!, 404));
    }

    [HttpPost]
    public async Task<IActionResult> CreateAccount(CreateMerchantAccountRequest request)
    {
        var result = await accountService.CreateAsync(MerchantHttp.GetUserId(User), request);
        return result.IsSuccess ? Ok(result.Value) : UnprocessableEntity(MerchantHttp.AccountToProblem(result.Error!, 422));
    }

    [HttpPut]
    public async Task<IActionResult> UpdateAccount(UpdateMerchantAccountRequest request)
    {
        var result = await accountService.UpdateAsync(MerchantHttp.GetUserId(User), request);
        return result.IsSuccess ? Ok(result.Value) : NotFound(MerchantHttp.AccountToProblem(result.Error!, 404));
    }

    [HttpDelete]
    public async Task<IActionResult> DeleteAccount()
    {
        var result = await accountService.DeleteAsync(MerchantHttp.GetUserId(User));
        return result.IsSuccess ? NoContent() : NotFound(MerchantHttp.AccountToProblem(result.Error!, 404));
    }
}
