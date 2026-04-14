using System.Text.Json;
using Ay.Domain.Entities;

namespace Ay.Infrastructure.Services;

/// <summary>
/// Consumer-facing open/closed evaluation aligned with the mobile app's
/// <c>getCurrentOpeningStatus</c> (manual modes, holidays, weekly hours).
/// Uses Pakistan local wall-clock time when available so listing filters match typical users.
/// </summary>
public static class ShopOpenStatusHelper
{
    private static readonly string[] DayKeys =
    [
        "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"
    ];

    public static bool IsOpenNow(Shop shop)
    {
        var mode = (shop.OpenStatusMode ?? "auto").ToLowerInvariant();
        return mode switch
        {
            "manual_open" => true,
            "manual_closed" => false,
            _ => EvaluateAuto(shop, ToBusinessLocalNow())
        };
    }

    private static DateTime ToBusinessLocalNow()
    {
        var utc = DateTime.UtcNow;
        foreach (var id in new[] { "Asia/Karachi", "Pakistan Standard Time" })
        {
            try
            {
                var tz = TimeZoneInfo.FindSystemTimeZoneById(id);
                return TimeZoneInfo.ConvertTimeFromUtc(utc, tz);
            }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }

        return utc;
    }

    private static bool EvaluateAuto(Shop shop, DateTime localNow)
    {
        if (shop.OpeningHours is null)
            return true;

        try
        {
            var root = shop.OpeningHours.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
                return true;

            var todayStr = localNow.ToString("yyyy-MM-dd");
            if (shop.Holidays is not null && shop.Holidays.RootElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var h in shop.Holidays.RootElement.EnumerateArray())
                {
                    if (h.TryGetProperty("date", out var d) && d.ValueKind == JsonValueKind.String &&
                        string.Equals(d.GetString(), todayStr, StringComparison.Ordinal))
                        return false;
                }
            }

            var dayKey = DayKeys[(int)localNow.DayOfWeek];
            if (!root.TryGetProperty(dayKey, out var dayEl) || dayEl.ValueKind != JsonValueKind.Object)
                return false;

            if (!dayEl.TryGetProperty("enabled", out var enabledEl) || !enabledEl.GetBoolean())
                return false;

            if (!dayEl.TryGetProperty("open", out var openEl) || openEl.ValueKind != JsonValueKind.String)
                return true;
            if (!dayEl.TryGetProperty("close", out var closeEl) || closeEl.ValueKind != JsonValueKind.String)
                return true;

            var openStr = openEl.GetString();
            var closeStr = closeEl.GetString();
            if (string.IsNullOrWhiteSpace(openStr) || string.IsNullOrWhiteSpace(closeStr))
                return true;

            if (!TryParseHm(openStr, out var openM) || !TryParseHm(closeStr, out var closeM))
                return true;

            var nowM = localNow.Hour * 60 + localNow.Minute;
            return nowM >= openM && nowM < closeM;
        }
        catch
        {
            return true;
        }
    }

    private static bool TryParseHm(string time, out int minutesFromMidnight)
    {
        minutesFromMidnight = 0;
        var parts = time.Split(':');
        if (parts.Length < 2) return false;
        if (!int.TryParse(parts[0], out var h) || !int.TryParse(parts[1], out var m))
            return false;
        if (h is < 0 or > 23 || m is < 0 or > 59)
            return false;
        minutesFromMidnight = h * 60 + m;
        return true;
    }
}
