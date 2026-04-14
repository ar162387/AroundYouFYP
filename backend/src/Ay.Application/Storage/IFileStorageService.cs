namespace Ay.Application.Storage;

/// <summary>
/// Persists merchant uploads to Cloudinary and returns an absolute <c>https://</c> URL stored on shop/item rows.
/// </summary>
public interface IFileStorageService
{
    /// <summary>
    /// Persist an uploaded stream and return a public URL string (e.g. <c>/uploads/shops/abc.jpg</c> or a Cloudinary HTTPS URL).
    /// </summary>
    Task<string> SaveAsync(Stream stream, string originalFileName, string subfolder);

    /// <summary>
    /// Best-effort delete for a previously stored URL. No-ops if the URL is unknown or the asset is already gone.
    /// </summary>
    void Delete(string storedUrl);
}
