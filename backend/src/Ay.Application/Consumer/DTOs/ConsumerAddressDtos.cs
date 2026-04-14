namespace Ay.Application.Consumer.DTOs;

public record CreateAddressRequest(string StreetAddress, string City, decimal Latitude, decimal Longitude, string? Title = null, string? Region = null, string? Landmark = null, string? FormattedAddress = null);
public record UpdateAddressRequest(string? Title = null, string? StreetAddress = null, string? City = null, string? Region = null, decimal? Latitude = null, decimal? Longitude = null, string? Landmark = null, string? FormattedAddress = null);
public record ConsumerAddressDto(Guid Id, string? Title, string StreetAddress, string City, string? Region, decimal Latitude, decimal Longitude, string? Landmark, string? FormattedAddress, DateTimeOffset CreatedAt);
