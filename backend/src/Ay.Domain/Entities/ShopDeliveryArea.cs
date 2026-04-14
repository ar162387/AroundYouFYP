using NetTopologySuite.Geometries;

namespace Ay.Domain.Entities;

/// <summary>
/// Represents a named delivery zone (polygon or other geometry) for a shop,
/// stored using PostGIS via NetTopologySuite.
/// </summary>
public class ShopDeliveryArea
{
    public Guid Id { get; set; }
    public Guid ShopId { get; set; }
    public string? Label { get; set; }

    /// <summary>
    /// PostGIS geometry column (SRID 4326 — WGS-84 lat/lon).
    /// Typically a Polygon but accepts any Geometry subtype.
    /// </summary>
    public Geometry Geom { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Shop Shop { get; set; } = null!;
}
