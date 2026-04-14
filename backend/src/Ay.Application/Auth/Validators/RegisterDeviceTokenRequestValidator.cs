using Ay.Application.Auth.DTOs;
using FluentValidation;

namespace Ay.Application.Auth.Validators;

public class RegisterDeviceTokenRequestValidator : AbstractValidator<RegisterDeviceTokenRequest>
{
    public RegisterDeviceTokenRequestValidator()
    {
        RuleFor(x => x.Token).NotEmpty().MaximumLength(500);
        RuleFor(x => x.Platform)
            .NotEmpty()
            .Must(p => p is "ios" or "android")
            .WithMessage("Platform must be 'ios' or 'android'.");
    }
}
