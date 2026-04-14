using Ay.Application.Auth.DTOs;
using FluentValidation;

namespace Ay.Application.Auth.Validators;

public class UpdateProfileRequestValidator : AbstractValidator<UpdateProfileRequest>
{
    public UpdateProfileRequestValidator()
    {
        RuleFor(x => x.Name).MaximumLength(100).When(x => x.Name is not null);
        RuleFor(x => x.PhoneNumber)
            .MaximumLength(20)
            .Matches(@"^\+?[0-9]+$")
            .When(x => !string.IsNullOrWhiteSpace(x.PhoneNumber));
    }
}
