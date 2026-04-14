namespace Ay.Infrastructure.Services;

/// <summary>
/// Parses <c>cloudinary://api_key:api_secret@cloud_name</c> (same as the CLOUDINARY_URL value in the Cloudinary console).
/// </summary>
internal static class CloudinaryUrlParser
{
    internal static (string CloudName, string ApiKey, string ApiSecret) Parse(string cloudinaryUrl)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(cloudinaryUrl);
        var trimmed = cloudinaryUrl.Trim();
        const string prefix = "cloudinary://";
        if (!trimmed.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "Cloudinary URL must use the cloudinary:// scheme (copy CLOUDINARY_URL from the Cloudinary dashboard).");
        }

        var rest = trimmed[prefix.Length..];
        var at = rest.LastIndexOf('@');
        if (at <= 0 || at >= rest.Length - 1)
            throw new InvalidOperationException("Cloudinary URL is missing '@cloud_name'.");

        var cloudName = rest[(at + 1)..].TrimEnd('/');
        var credentials = rest[..at];
        var colon = credentials.IndexOf(':');
        if (colon <= 0 || colon >= credentials.Length - 1)
            throw new InvalidOperationException("Cloudinary URL is missing 'api_key:api_secret'.");

        var apiKey = credentials[..colon];
        var apiSecret = Uri.UnescapeDataString(credentials[(colon + 1)..]);
        return (cloudName, apiKey, apiSecret);
    }
}
