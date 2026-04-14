using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace Ay.WebApi.Controllers.Consumer;

internal static class ConsumerHttp
{
    public static Guid GetUserId(ClaimsPrincipal user) =>
        Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? user.FindFirstValue("sub")
            ?? throw new UnauthorizedAccessException());

    public static ProblemDetails ToProblem(string detail, int status) => new()
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
