namespace Ay.Application.Consumer.DTOs;

public record ConsumerProfileDto(Guid Id, string? Email, string? Name, string Role, DateTimeOffset CreatedAt);
public record UpdateConsumerProfileRequest(string? Name);
