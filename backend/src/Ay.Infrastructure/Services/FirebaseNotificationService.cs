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
        Dictionary<string, string>? data = null,
        string? role = null)
    {
        var targetRole = NormalizeRole(role ?? GetPayloadValue(data, "role") ?? GetPayloadValue(data, "notificationRole"));
        logger.LogInformation(
            "[FCM] SendAsync called: userId={UserId}, role={Role}, title={Title}",
            userId, targetRole ?? "(any)", title);

        await using var scope = scopeFactory.CreateAsyncScope();
        var deviceTokenRepo = scope.ServiceProvider.GetRequiredService<IDeviceTokenRepository>();
        var prefRepo = scope.ServiceProvider.GetRequiredService<INotificationPreferenceRepository>();

        // 1. Check notification preferences. Role-specific sends use that role's
        // row so a dual consumer/merchant account does not collapse both streams.
        var allowPush = await AllowsPushAsync(prefRepo, userId, targetRole);

        if (!allowPush)
        {
            logger.LogWarning(
                "[FCM] Push suppressed for user {UserId}, role={Role}",
                userId,
                targetRole ?? "(any)");
            return;
        }

        // 2. Fetch device tokens
        var tokens = await deviceTokenRepo.GetByUserIdAsync(userId);
        logger.LogInformation("[FCM] Device tokens for {UserId}: count={Count}", userId, tokens.Count);
        if (tokens.Count == 0)
        {
            logger.LogWarning("[FCM] No device tokens for user {UserId}; cannot send", userId);
            return;
        }

        EnsureFirebaseInitialised();

        var messaging = FirebaseMessaging.DefaultInstance;
        var payload = BuildPayload(data, targetRole);
        foreach (var device in tokens)
        {
            try
            {
                var message = new Message
                {
                    Token = device.Token,
                    Notification = new Notification { Title = title, Body = body },
                    Data = payload,
                    Android = new AndroidConfig { Priority = Priority.High },
                    Apns = new ApnsConfig
                    {
                        Aps = new Aps { Sound = "default", ContentAvailable = true }
                    },
                };

                var messageId = await messaging.SendAsync(message);
                logger.LogInformation(
                    "[FCM] Sent to user {UserId} token ...{Suffix}: messageId={MessageId}",
                    userId, device.Token[^6..], messageId);
            }
            catch (FirebaseMessagingException ex) when (
                ex.MessagingErrorCode is MessagingErrorCode.InvalidArgument
                    or MessagingErrorCode.Unregistered
                    or MessagingErrorCode.SenderIdMismatch)
            {
                logger.LogWarning(
                    "[FCM] Removing stale token for user {UserId}: {Error}", userId, ex.Message);
                await deviceTokenRepo.DeleteByTokenAsync(device.Token);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[FCM] Send FAILED for user {UserId}", userId);
            }
        }
    }

    private async Task<bool> AllowsPushAsync(
        INotificationPreferenceRepository prefRepo,
        Guid userId,
        string? targetRole)
    {
        if (targetRole is not null)
        {
            var pref = await prefRepo.GetAsync(userId, targetRole);
            var allow = pref?.AllowPushNotifications ?? true;
            logger.LogInformation(
                "[FCM] Pref for {UserId}, role={Role}: row={Exists}, allow={Allow}",
                userId,
                targetRole,
                pref is not null,
                allow);
            return allow;
        }

        var consumerPref = await prefRepo.GetAsync(userId, "consumer");
        var merchantPref = await prefRepo.GetAsync(userId, "merchant");
        var consumerAllows = consumerPref?.AllowPushNotifications ?? true;
        var merchantAllows = merchantPref?.AllowPushNotifications ?? true;
        var allowPush = consumerAllows || merchantAllows;

        logger.LogInformation(
            "[FCM] Prefs for {UserId}: consumerRow={ConsumerExists}({ConsumerAllows}), merchantRow={MerchantExists}({MerchantAllows}), allow={Allow}",
            userId,
            consumerPref is not null, consumerAllows,
            merchantPref is not null, merchantAllows,
            allowPush);

        return allowPush;
    }

    private static string? GetPayloadValue(Dictionary<string, string>? data, string key)
        => data is not null && data.TryGetValue(key, out var value) ? value : null;

    private static string? NormalizeRole(string? role)
    {
        if (string.IsNullOrWhiteSpace(role)) return null;

        var normalized = role.Trim().ToLowerInvariant();
        return normalized is "consumer" or "merchant" ? normalized : null;
    }

    private static Dictionary<string, string> BuildPayload(
        Dictionary<string, string>? data,
        string? targetRole)
    {
        var payload = data is null
            ? new Dictionary<string, string>()
            : new Dictionary<string, string>(data);

        if (targetRole is not null)
        {
            payload["role"] = targetRole;
            payload["notificationRole"] = targetRole;
        }

        return payload;
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
