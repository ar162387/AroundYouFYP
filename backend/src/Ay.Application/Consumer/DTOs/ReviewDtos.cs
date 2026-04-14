namespace Ay.Application.Consumer.DTOs;

public record CreateReviewRequest(Guid ShopId, int Rating, Guid? OrderId = null, string? ReviewText = null);
public record ReviewDto(Guid Id, Guid UserId, Guid ShopId, Guid? OrderId, int Rating, string? ReviewText, DateTimeOffset CreatedAt);
