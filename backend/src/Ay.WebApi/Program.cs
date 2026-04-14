using Ay.Application.Extensions;
using Ay.Application.Notifications;
using Ay.Infrastructure.Extensions;
using Ay.Infrastructure.Persistence;
using Ay.WebApi.Hosting;
using Ay.WebApi.Hubs;
using Ay.WebApi.Middleware;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Serilog;
using Serilog.Events;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.Hosting.Lifetime", LogEventLevel.Information)
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .WriteTo.File(
        path: "logs/ay-.log",
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 14,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSignalR();

builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddApplicationServices();
builder.Services.AddInfrastructureServices(builder.Configuration);
builder.Services.AddScoped<IOrderHubContext, SignalROrderHubContext>();
builder.Services.AddHostedService<DatabaseMigrationHostedService>();
builder.Services.AddHostedService<TemplateSeedHostedService>();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        if (allowedOrigins.Length == 0)
        {
            policy.AllowAnyHeader().AllowAnyMethod();
            return;
        }

        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

app.UseSerilogRequestLogging();
app.UseStaticFiles();
app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
    KnownIPNetworks = { },
    KnownProxies = { }
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<OrderHub>("/hubs/orders");

app.MapGet("/health/live", () => Results.Ok(new { status = "live", timestamp = DateTimeOffset.UtcNow }));
app.MapGet("/health/ready", async (AppDbContext db, CancellationToken ct) =>
{
    var dbReady = await db.Database.CanConnectAsync(ct);
    return dbReady
        ? Results.Ok(new { status = "ready", timestamp = DateTimeOffset.UtcNow })
        : Results.Problem(
            title: "Database unavailable",
            detail: "The API is running but cannot reach the database.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
});

app.Run();
