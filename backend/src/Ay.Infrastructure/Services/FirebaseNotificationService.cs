using Ay.Application.Notifications;
using Ay.Domain.Interfaces;
using FirebaseAdmin;
using FirebaseAdmin.Messaging;
using Google.Apis.Auth.OAuth2;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Ay.Infrastructure.Services;

/// <summary>
/// Singleton service; uses IServiceScopeFactory to safely resolve scoped
/// repositories without a captive-dependency issue.
/// </summary>
public class FirebaseNotificationService(
    IServiceScopeFactory scopeFactory,
    IConfiguration config,
    ILogger<FirebaseNotificationService> logger) : INotificationService
{
    private static readonly object _initLock = new();
    private static bool _initialized;

    public async Task SendAsync(
        Guid userId,
        string title,
        string body,
        Dictionary<string, string>? data = null)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var deviceTokenRepo = scope.ServiceProvider.GetRequiredService<IDeviceTokenRepository>();
        var prefRepo = scope.ServiceProvider.GetRequiredService<INotificationPreferenceRepository>();

        // 1. Check notification preferences
        // Notification preference is treated as user-level (role-agnostic).
        // Fallback to legacy merchant-row in case older data exists there.
        var pref = await prefRepo.GetAsync(userId, "consumer")
            ?? await prefRepo.GetAsync(userId, "merchant");
        if (pref is not null && !pref.AllowPushNotifications)
        {
            logger.LogDebug("Push suppressed for user {UserId} (preference off)", userId);
            return;
        }

        // 2. Fetch device tokens
        var tokens = await deviceTokenRepo.GetByUserIdAsync(userId);
        if (tokens.Count == 0)
        {
            logger.LogDebug("No device tokens registered for user {UserId}", userId);
            return;
        }

        EnsureFirebaseInitialised();

        var messaging = FirebaseMessaging.DefaultInstance;
        foreach (var device in tokens)
        {
            try
            {
                var message = new Message
                {
                    Token = device.Token,
                    Notification = new Notification { Title = title, Body = body },
                    Data = data ?? new Dictionary<string, string>(),
                    Android = new AndroidConfig { Priority = Priority.High },
                    Apns = new ApnsConfig
                    {
                        Aps = new Aps { Sound = "default", ContentAvailable = true }
                    },
                };

                var messageId = await messaging.SendAsync(message);
                logger.LogInformation(
                    "FCM sent to user {UserId} token …{Suffix}: {MessageId}",
                    userId, device.Token[^6..], messageId);
            }
            catch (FirebaseMessagingException ex) when (
                ex.MessagingErrorCode is MessagingErrorCode.InvalidArgument
                    or MessagingErrorCode.Unregistered
                    or MessagingErrorCode.SenderIdMismatch)
            {
                // Stale / invalid token — remove it so we don't keep trying
                logger.LogWarning(
                    "Removing stale FCM token for user {UserId}: {Error}", userId, ex.Message);
                await deviceTokenRepo.DeleteByTokenAsync(device.Token);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "FCM send failed for user {UserId}", userId);
            }
        }
    }

    private void EnsureFirebaseInitialised()
    {
        if (_initialized) return;
        lock (_initLock)
        {
            if (_initialized) return;

            var credPath = config["Firebase:CredentialsPath"];
            GoogleCredential credential;

            if (!string.IsNullOrWhiteSpace(credPath) && File.Exists(credPath))
            {
                credential = GoogleCredential.FromFile(credPath);
            }
            else
            {
                // Fall back to Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS env var)
                credential = GoogleCredential.GetApplicationDefault();
            }

            if (FirebaseApp.DefaultInstance is null)
            {
                FirebaseApp.Create(new AppOptions { Credential = credential });
                logger.LogInformation("Firebase Admin SDK initialised");
            }

            _initialized = true;
        }
    }
}
