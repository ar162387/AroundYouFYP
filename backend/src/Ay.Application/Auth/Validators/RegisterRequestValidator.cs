using Ay.Application.Auth.DTOs;
using FluentValidation;

namespace Ay.Application.Auth.Validators;

public class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password)
            .NotEmpty()
            .MinimumLength(8)
            .Matches(@"[a-zA-Z]").WithMessage("Password must contain at least one letter.")
            .Matches(@"[0-9]").WithMessage("Password must contain at least one digit.");
        RuleFor(x => x.Name).MaximumLength(100).When(x => x.Name is not null);
    }
}
