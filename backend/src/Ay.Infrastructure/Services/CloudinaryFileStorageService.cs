using Ay.Application.Storage;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.Extensions.Logging;

namespace Ay.Infrastructure.Services;

/// <summary>
/// Stores merchant images on Cloudinary and returns HTTPS URLs suitable for persisting on shop/item rows.
/// </summary>
public class CloudinaryFileStorageService(
    Cloudinary cloudinary,
    ILogger<CloudinaryFileStorageService> logger) : IFileStorageService
{
    private static readonly HashSet<string> AllowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

    public async Task<string> SaveAsync(Stream stream, string originalFileName, string subfolder)
    {
        var ext = Path.GetExtension(originalFileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(ext))
        {
            throw new InvalidOperationException(
                $"File type '{ext}' is not allowed. Permitted: {string.Join(", ", AllowedExtensions)}");
        }

        if (stream.CanSeek)
            stream.Position = 0;

        var objectName = $"{Guid.NewGuid():N}{ext}";
        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription(objectName, stream),
            Folder = $"ay/{subfolder}",
            UseFilename = false,
            UniqueFilename = false,
            Overwrite = false,
        };

        var result = await cloudinary.UploadAsync(uploadParams);
        if (result.Error != null)
            throw new InvalidOperationException($"Cloudinary upload failed: {result.Error.Message}");

        var url = result.SecureUrl?.ToString() ?? result.Url?.ToString();
        if (string.IsNullOrWhiteSpace(url))
            throw new InvalidOperationException("Cloudinary upload returned no URL.");

        logger.LogInformation("Cloudinary upload saved public_id={PublicId}", result.PublicId);
        return url;
    }

    public void Delete(string storedUrl)
    {
        if (string.IsNullOrWhiteSpace(storedUrl))
            return;

        if (storedUrl.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase))
            return;

        var publicId = TryExtractImagePublicId(storedUrl);
        if (string.IsNullOrEmpty(publicId))
        {
            logger.LogWarning("Cloudinary delete skipped; could not parse public_id from URL: {Url}", storedUrl);
            return;
        }

        try
        {
            var deletionParams = new DeletionParams(publicId) { ResourceType = ResourceType.Image };
            var result = cloudinary.Destroy(deletionParams);
            if (result.Error != null)
                logger.LogWarning("Cloudinary destroy failed for {PublicId}: {Message}", publicId, result.Error.Message);
            else
                logger.LogInformation("Cloudinary destroy result={Result} public_id={PublicId}", result.Result, publicId);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Cloudinary destroy threw for public_id={PublicId}", publicId);
        }
    }

    /// <summary>
    /// Derives image <c>public_id</c> from a delivery URL (no uploads/ transforms in stored URLs today).
    /// </summary>
    internal static string? TryExtractImagePublicId(string url)
    {
        if (!url.Contains("res.cloudinary.com", StringComparison.OrdinalIgnoreCase))
            return null;

        const string marker = "/image/upload/";
        var mIdx = url.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (mIdx < 0)
            return null;

        var path = url[(mIdx + marker.Length)..];
        var q = path.IndexOf('?');
        if (q >= 0)
            path = path[..q];

        while (path.Length > 0)
        {
            var slash = path.IndexOf('/');
            var segment = slash < 0 ? path : path[..slash];
            if (segment.Contains(',') || segment.Contains('='))
                path = slash < 0 ? string.Empty : path[(slash + 1)..];
            else
                break;
        }

        if (path.Length > 1 && path[0] == 'v' && char.IsDigit(path[1]))
        {
            var slash = path.IndexOf('/');
            if (slash > 0)
                path = path[(slash + 1)..];
        }

        var lastDot = path.LastIndexOf('.');
        if (lastDot > 0)
        {
            var maybeExt = path[lastDot..].ToLowerInvariant();
            if (maybeExt is ".jpg" or ".jpeg" or ".png" or ".webp" or ".gif")
                path = path[..lastDot];
        }

        path = path.Replace('\\', '/').Trim('/');
        return string.IsNullOrEmpty(path) ? null : path;
    }
}
