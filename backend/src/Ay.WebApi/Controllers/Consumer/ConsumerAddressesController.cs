using Ay.Application.Consumer.DTOs;
using Ay.Application.Consumer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ay.WebApi.Controllers.Consumer;

[ApiController]
[Route("api/v1/consumer/addresses")]
[Authorize(Roles = "consumer,merchant,admin")]
public class ConsumerAddressesController(IConsumerAddressService addressService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAddresses()
    {
        var result = await addressService.GetAddressesAsync(ConsumerHttp.GetUserId(User));
        return result.IsSuccess ? Ok(result.Value) : NotFound(ConsumerHttp.ToProblem(result.Error!, 404));
    }

    [HttpGet("{addressId:guid}")]
    public async Task<IActionResult> GetAddress(Guid addressId)
    {
        var result = await addressService.GetAddressByIdAsync(addressId, ConsumerHttp.GetUserId(User));
        return result.IsSuccess ? Ok(result.Value) : NotFound(ConsumerHttp.ToProblem(result.Error!, 404));
    }

    [HttpPost]
    public async Task<IActionResult> CreateAddress(CreateAddressRequest request)
    {
        var result = await addressService.CreateAddressAsync(ConsumerHttp.GetUserId(User), request);
        return result.IsSuccess ? Ok(result.Value) : UnprocessableEntity(ConsumerHttp.ToProblem(result.Error!, 422));
    }

    [HttpPut("{addressId:guid}")]
    public async Task<IActionResult> UpdateAddress(Guid addressId, UpdateAddressRequest request)
    {
        var result = await addressService.UpdateAddressAsync(addressId, ConsumerHttp.GetUserId(User), request);
        return result.IsSuccess ? Ok(result.Value) : NotFound(ConsumerHttp.ToProblem(result.Error!, 404));
    }

    [HttpDelete("{addressId:guid}")]
    public async Task<IActionResult> DeleteAddress(Guid addressId)
    {
        var result = await addressService.DeleteAddressAsync(addressId, ConsumerHttp.GetUserId(User));
        return result.IsSuccess ? NoContent() : NotFound(ConsumerHttp.ToProblem(result.Error!, 404));
    }
}
