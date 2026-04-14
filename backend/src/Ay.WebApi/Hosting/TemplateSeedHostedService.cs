using System.Text.Json;
using Ay.Domain.Entities;
using Ay.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Ay.WebApi.Hosting;

/// <summary>
/// Seeds category and item templates from image_data.json for merchant inventory setup.
/// </summary>
public sealed class TemplateSeedHostedService(
    IServiceScopeFactory scopeFactory,
    IHostEnvironment hostEnvironment,
    ILogger<TemplateSeedHostedService> logger) : IHostedService
{
    private const string DefaultItemUnit = "unit";

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var jsonPath = ResolveImageDataPath();
        if (jsonPath is null)
        {
            logger.LogWarning("Template seed skipped: image_data.json was not found.");
            return;
        }

        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        List<ImageDataEntry>? entries;
        try
        {
            var json = await File.ReadAllTextAsync(jsonPath, cancellationToken);
            entries = JsonSerializer.Deserialize<List<ImageDataEntry>>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
            });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Template seed failed: could not parse {Path}", jsonPath);
            return;
        }

        if (entries is null || entries.Count == 0)
        {
            logger.LogWarning("Template seed skipped: no rows found in {Path}", jsonPath);
            return;
        }

        var categoryLookup = await db.CategoryTemplates
            .ToDictionaryAsync(c => c.Name.Trim().ToLowerInvariant(), c => c, cancellationToken);
        var itemLookup = await db.ItemTemplates
            .ToDictionaryAsync(i => (i.NameNormalized ?? string.Empty).Trim(), i => i, cancellationToken);

        string? currentCategory = null;
        var addedCategories = 0;
        var addedItems = 0;
        var updatedItems = 0;

        foreach (var entry in entries)
        {
            if (!string.IsNullOrWhiteSpace(entry.CATEGORY))
            {
                currentCategory = entry.CATEGORY.Trim();
                var categoryKey = currentCategory.ToLowerInvariant();
                if (!categoryLookup.ContainsKey(categoryKey))
                {
                    var categoryTemplate = new CategoryTemplate
                    {
                        Id = Guid.NewGuid(),
                        Name = currentCategory,
                        Description = BuildCategoryDescription(currentCategory),
                    };
                    db.CategoryTemplates.Add(categoryTemplate);
                    categoryLookup[categoryKey] = categoryTemplate;
                    addedCategories++;
                }
                continue;
            }

            if (string.IsNullOrWhiteSpace(entry.alt) || string.IsNullOrWhiteSpace(entry.src))
            {
                continue;
            }

            var itemName = entry.alt.Trim();
            var nameNormalized = itemName.ToLowerInvariant();
            var itemDescription = BuildItemDescription(itemName, currentCategory);
            var imageUrl = entry.src.Trim();

            if (itemLookup.TryGetValue(nameNormalized, out var existing))
            {
                var changed = false;
                if (!string.Equals(existing.ImageUrl, imageUrl, StringComparison.Ordinal))
                {
                    existing.ImageUrl = imageUrl;
                    changed = true;
                }
                if (!string.Equals(existing.Description, itemDescription, StringComparison.Ordinal))
                {
                    existing.Description = itemDescription;
                    changed = true;
                }
                if (string.IsNullOrWhiteSpace(existing.DefaultUnit))
                {
                    existing.DefaultUnit = DefaultItemUnit;
                    changed = true;
                }

                if (changed)
                {
                    existing.UpdatedAt = DateTimeOffset.UtcNow;
                    updatedItems++;
                }

                continue;
            }

            var itemTemplate = new ItemTemplate
            {
                Id = Guid.NewGuid(),
                Name = itemName,
                NameNormalized = nameNormalized,
                Description = itemDescription,
                ImageUrl = imageUrl,
                DefaultUnit = DefaultItemUnit,
            };

            db.ItemTemplates.Add(itemTemplate);
            itemLookup[nameNormalized] = itemTemplate;
            addedItems++;
        }

        if (addedCategories == 0 && addedItems == 0 && updatedItems == 0)
        {
            logger.LogInformation("Template seed already up to date.");
            return;
        }

        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation(
            "Template seed complete. Categories added: {AddedCategories}, items added: {AddedItems}, items updated: {UpdatedItems}",
            addedCategories,
            addedItems,
            updatedItems);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private string? ResolveImageDataPath()
    {
        var candidates = new[]
        {
            Path.Combine(hostEnvironment.ContentRootPath, "..", "image_data.json"),
            Path.Combine(hostEnvironment.ContentRootPath, "image_data.json"),
            Path.Combine(Directory.GetCurrentDirectory(), "image_data.json"),
        };

        return candidates.FirstOrDefault(File.Exists);
    }

    private static string BuildCategoryDescription(string category)
    {
        return $"{category} picks curated for quick shelf setup and everyday demand.";
    }

    private static string BuildItemDescription(string itemName, string? category)
    {
        if (!string.IsNullOrWhiteSpace(category))
        {
            return $"Ready-to-add {category} product: {itemName}.";
        }

        return $"Ready-to-add product template: {itemName}.";
    }

    private sealed class ImageDataEntry
    {
        public string? CATEGORY { get; set; }
        public string? src { get; set; }
        public string? alt { get; set; }
    }
}
