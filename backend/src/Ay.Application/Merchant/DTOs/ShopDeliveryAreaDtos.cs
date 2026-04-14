namespace Ay.Application.Merchant.DTOs;

/// <summary>
/// GeoJSON-style coordinate pair used in delivery-area requests and responses.
/// </summary>
public record CoordinateDto(double Longitude, double Latitude);

public record CreateDeliveryAreaRequest(
    string? Label,
    /// <summary>Ordered ring of coordinates. First == last to close the polygon.</summary>
    CoordinateDto[] Coordinates);

public record DeliveryAreaDto(
    Guid Id,
    Guid ShopId,
    string? Label,
    CoordinateDto[] Coordinates,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
