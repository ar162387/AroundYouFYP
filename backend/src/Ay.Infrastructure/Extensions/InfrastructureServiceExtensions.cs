using System.Text;
using Ay.Application.Auth.Services;
using Ay.Application.Consumer.Services;
using Ay.Application.Merchant.Services;
using Ay.Application.Notifications;
using Ay.Application.Storage;
using Ay.Domain.Interfaces;
using Ay.Infrastructure.Identity;
using Ay.Infrastructure.Persistence;
using Ay.Infrastructure.Persistence.Repositories;
using Ay.Infrastructure.Services;
using CloudinaryDotNet;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace Ay.Infrastructure.Extensions;

public static class InfrastructureServiceExtensions
{
    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services, IConfiguration config)
    {
        var connectionString = config.GetConnectionString("Default")
            ?? throw new InvalidOperationException("ConnectionStrings:Default is not configured.");

        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(connectionString, npgsql => npgsql.UseNetTopologySuite()));

        services.AddIdentityCore<AppUser>(options =>
        {
            options.Password.RequiredLength = 8;
            options.Password.RequireDigit = true;
            options.Password.RequireLowercase = true;
            options.Password.RequireUppercase = false;
            options.Password.RequireNonAlphanumeric = false;
            options.User.RequireUniqueEmail = true;
        })
        .AddRoles<IdentityRole<Guid>>()
        .AddEntityFrameworkStores<AppDbContext>()
        .AddDefaultTokenProviders();

        var jwtSecret = config["Jwt:Secret"]
            ?? throw new InvalidOperationException("Jwt:Secret is not configured.");
        var jwtIssuer = config["Jwt:Issuer"] ?? "ay-backend";
        var jwtAudience = config["Jwt:Audience"] ?? "ay-mobile";

        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = jwtIssuer,
                ValidAudience = jwtAudience,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
                ClockSkew = TimeSpan.FromMinutes(1)
            };
        });

        services.AddAuthorizationBuilder()
            .AddPolicy("ConsumerOnly", p => p.RequireRole("consumer", "merchant", "admin"))
            .AddPolicy("MerchantOnly", p => p.RequireRole("merchant"))
            .AddPolicy("AdminOnly", p => p.RequireRole("admin"));

        // Phase 1 — Auth
        services.AddScoped<IUserProfileRepository, UserProfileRepository>();
        services.AddScoped<IDeviceTokenRepository, DeviceTokenRepository>();
        services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();
        services.AddScoped<IAuthService, Ay.Infrastructure.Identity.AuthService>();

        // Phase 2 — Merchant repositories
        services.AddScoped<IMerchantAccountRepository, MerchantAccountRepository>();
        services.AddScoped<IShopRepository, ShopRepository>();
        services.AddScoped<ICategoryRepository, CategoryRepository>();
        services.AddScoped<IItemRepository, ItemRepository>();
        services.AddScoped<IDeliveryLogicRepository, DeliveryLogicRepository>();
        services.AddScoped<IDeliveryRunnerRepository, DeliveryRunnerRepository>();
        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<IAuditLogRepository, AuditLogRepository>();
        services.AddScoped<IMerchantItemAuditService, MerchantItemAuditService>();

        // Phase 2 — Merchant services
        services.AddScoped<IMerchantAccountService, MerchantAccountService>();
        services.AddScoped<IMerchantVerificationAdminService, MerchantVerificationAdminService>();
        services.AddScoped<IShopService, ShopService>();
        services.AddScoped<IInventoryService, InventoryService>();
        services.AddScoped<IDeliveryLogicService, DeliveryLogicService>();
        services.AddScoped<IDeliveryRunnerService, DeliveryRunnerService>();
        services.AddScoped<IMerchantOrderService, MerchantOrderService>();
        services.AddScoped<IDeliveryAreaService, DeliveryAreaService>();

        // Phase 3 — Consumer repositories
        services.AddScoped<IConsumerAddressRepository, ConsumerAddressRepository>();
        services.AddScoped<IReviewRepository, ReviewRepository>();
        services.AddScoped<INotificationPreferenceRepository, NotificationPreferenceRepository>();

        // Notifications (FCM)
        services.AddSingleton<INotificationService, FirebaseNotificationService>();

        // Merchant image uploads (shop + inventory) — Cloudinary only.
        var cloudinaryUrl = config["CLOUDINARY_URL"] ?? config["Cloudinary:Url"];
        if (string.IsNullOrWhiteSpace(cloudinaryUrl))
        {
            throw new InvalidOperationException(
                "Cloudinary is required: set environment variable CLOUDINARY_URL or configuration key Cloudinary:Url " +
                "(cloudinary://api_key:api_secret@cloud_name from the Cloudinary dashboard).");
        }

        var (cloudName, apiKey, apiSecret) = CloudinaryUrlParser.Parse(cloudinaryUrl);
        services.AddSingleton(_ => new Cloudinary(new Account(cloudName, apiKey, apiSecret)));
        services.AddScoped<IFileStorageService, CloudinaryFileStorageService>();

        // Phase 3 — Consumer services
        services.AddScoped<IConsumerProfileService, ConsumerProfileService>();
        services.AddScoped<IConsumerAddressService, ConsumerAddressService>();
        services.AddScoped<IConsumerShopService, ConsumerShopService>();
        services.AddScoped<IConsumerOrderService, ConsumerOrderService>();
        services.AddScoped<IDeliveryFeeCalculatorService, DeliveryFeeCalculatorService>();
        services.AddScoped<IReviewService, ReviewService>();
        services.AddScoped<INotificationPreferenceService, NotificationPreferenceService>();

        return services;
    }
}
