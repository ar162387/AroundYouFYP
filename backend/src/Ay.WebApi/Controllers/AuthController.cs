using System.Security.Claims;
using Ay.Application.Auth.DTOs;
using Ay.Application.Auth.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ay.WebApi.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController(IAuthService authService, IDeviceTokenService deviceTokenService) : ControllerBase
{
    private Guid GetUserId() =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub")
            ?? throw new UnauthorizedAccessException());

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var result = await authService.RegisterAsync(request);
        return result.IsSuccess
            ? Ok(result.Value)
            : UnprocessableEntity(ToProblem(result.Error!, StatusCodes.Status422UnprocessableEntity));
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var result = await authService.LoginAsync(request);
        return result.IsSuccess
            ? Ok(result.Value)
            : Unauthorized(ToProblem(result.Error!, StatusCodes.Status401Unauthorized));
    }

    [HttpPost("google")]
    public async Task<IActionResult> Google(GoogleSignInRequest request)
    {
        var result = await authService.GoogleSignInAsync(request);
        return result.IsSuccess
            ? Ok(result.Value)
            : Unauthorized(ToProblem(result.Error!, StatusCodes.Status401Unauthorized));
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var result = await authService.GetCurrentUserAsync(GetUserId(), User);
        return result.IsSuccess
            ? Ok(result.Value)
            : NotFound(ToProblem(result.Error!, StatusCodes.Status404NotFound));
    }

    [Authorize]
    [HttpPut("me")]
    public async Task<IActionResult> UpdateProfile(UpdateProfileRequest request)
    {
        var result = await authService.UpdateProfileAsync(GetUserId(), request);
        return result.IsSuccess
            ? NoContent()
            : NotFound(ToProblem(result.Error!, StatusCodes.Status404NotFound));
    }

    [Authorize]
    [HttpDelete("me")]
    public async Task<IActionResult> DeleteAccount()
    {
        var result = await authService.DeleteAccountAsync(GetUserId());
        return result.IsSuccess
            ? NoContent()
            : UnprocessableEntity(ToProblem(result.Error!, StatusCodes.Status422UnprocessableEntity));
    }

    [Authorize]
    [HttpPost("device-token")]
    public async Task<IActionResult> RegisterDeviceToken(RegisterDeviceTokenRequest request)
    {
        var result = await deviceTokenService.RegisterTokenAsync(GetUserId(), request);
        return result.IsSuccess
            ? Ok()
            : UnprocessableEntity(ToProblem(result.Error!, StatusCodes.Status422UnprocessableEntity));
    }

    [Authorize]
    [HttpDelete("device-token")]
    public async Task<IActionResult> RemoveDeviceToken(RemoveDeviceTokenRequest request)
    {
        var result = await deviceTokenService.RemoveTokenAsync(GetUserId(), request.Token);
        return result.IsSuccess
            ? NoContent()
            : UnprocessableEntity(ToProblem(result.Error!, StatusCodes.Status422UnprocessableEntity));
    }

    private static ProblemDetails ToProblem(string detail, int status) => new()
    {
        Title = status switch
        {
            401 => "Authentication failed.",
            404 => "Resource not found.",
            422 => "Validation or business rule failed.",
            _ => "An error occurred."
        },
        Detail = detail,
        Status = status,
        Type = "https://tools.ietf.org/html/rfc7807"
    };
}
