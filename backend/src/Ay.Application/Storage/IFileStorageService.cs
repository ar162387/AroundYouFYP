namespace Ay.Application.Storage;

/// <summary>
/// Saves uploaded files under wwwroot/uploads/ and returns the relative URL.
/// </summary>
public interface IFileStorageService
{
    /// <summary>
    /// Persist an uploaded stream and return the public URL path, e.g.
    /// "/uploads/shops/abc123.jpg".
    /// </summary>
    Task<string> SaveAsync(Stream stream, string originalFileName, string subfolder);

    /// <summary>
    /// Delete a previously saved file identified by its relative URL path.
    /// No-ops gracefully if the file does not exist.
    /// </summary>
    void Delete(string relativeUrl);
}
