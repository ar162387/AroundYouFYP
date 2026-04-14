using Ay.Application.Auth.DTOs;
using FluentValidation;

namespace Ay.Application.Auth.Validators;

public class UpdateProfileRequestValidator : AbstractValidator<UpdateProfileRequest>
{
    public UpdateProfileRequestValidator()
    {
        RuleFor(x => x.Name).MaximumLength(100).When(x => x.Name is not null);
    }
}
