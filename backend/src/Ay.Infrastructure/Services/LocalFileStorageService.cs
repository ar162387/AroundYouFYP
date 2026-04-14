using Ay.Application.Storage;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;

namespace Ay.Infrastructure.Services;

public class LocalFileStorageService(
    IWebHostEnvironment env,
    ILogger<LocalFileStorageService> logger) : IFileStorageService
{
    private static readonly HashSet<string> AllowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

    public async Task<string> SaveAsync(Stream stream, string originalFileName, string subfolder)
    {
        var ext = Path.GetExtension(originalFileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(ext))
            throw new InvalidOperationException($"File type '{ext}' is not allowed. Permitted: {string.Join(", ", AllowedExtensions)}");

        var uploadsRoot = Path.Combine(env.ContentRootPath, "wwwroot", "uploads", subfolder);
        Directory.CreateDirectory(uploadsRoot);

        var fileName = $"{Guid.NewGuid():N}{ext}";
        var filePath = Path.Combine(uploadsRoot, fileName);

        await using var fs = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None);
        await stream.CopyToAsync(fs);

        var relativeUrl = $"/uploads/{subfolder}/{fileName}";
        logger.LogInformation("Saved upload: {Path}", relativeUrl);
        return relativeUrl;
    }

    public void Delete(string relativeUrl)
    {
        if (string.IsNullOrWhiteSpace(relativeUrl)) return;

        // Sanitise: only allow paths under /uploads/
        if (!relativeUrl.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase))
        {
            logger.LogWarning("Attempt to delete non-upload path blocked: {Url}", relativeUrl);
            return;
        }

        var filePath = Path.Combine(
            env.ContentRootPath, "wwwroot",
            relativeUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));

        if (File.Exists(filePath))
        {
            File.Delete(filePath);
            logger.LogInformation("Deleted upload: {Path}", relativeUrl);
        }
    }
}
