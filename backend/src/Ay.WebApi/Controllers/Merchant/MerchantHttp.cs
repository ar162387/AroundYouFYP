using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace Ay.WebApi.Controllers.Merchant;

internal static class MerchantHttp
{
    public static Guid GetUserId(ClaimsPrincipal user) =>
        Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? user.FindFirstValue("sub")
            ?? throw new UnauthorizedAccessException());

    public static ProblemDetails ToProblem(string detail, int status) => new()
    {
        Title = status switch
        {
            401 => "Authentication failed.",
            403 => "Access denied.",
            404 => "Resource not found.",
            422 => "Validation or business rule failed.",
            _ => "An error occurred."
        },
        Detail = detail,
        Status = status,
        Type = "https://tools.ietf.org/html/rfc7807"
    };

    public static ProblemDetails AccountToProblem(string detail, int status) => new()
    {
        Title = status switch
        {
            404 => "Resource not found.",
            422 => "Validation or business rule failed.",
            _ => "An error occurred."
        },
        Detail = detail,
        Status = status,
        Type = "https://tools.ietf.org/html/rfc7807"
    };
}
