using Ay.Application.Auth.Services;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace Ay.Application.Extensions;

public static class ApplicationServiceExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddValidatorsFromAssemblyContaining<Auth.Validators.RegisterRequestValidator>();
        services.AddScoped<IDeviceTokenService, DeviceTokenService>();
        return services;
    }
}
