using Ay.Application.Auth.DTOs;
using FluentValidation;

namespace Ay.Application.Auth.Validators;

public class GoogleSignInRequestValidator : AbstractValidator<GoogleSignInRequest>
{
    public GoogleSignInRequestValidator()
    {
        RuleFor(x => x.IdToken).NotEmpty().MinimumLength(50);
    }
}
