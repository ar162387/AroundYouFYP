namespace Ay.Application.Merchant.DTOs;

public record CreateRunnerRequest(string Name, string PhoneNumber);
public record UpdateRunnerRequest(string? Name = null, string? PhoneNumber = null);
public record DeliveryRunnerDto(Guid Id, Guid ShopId, string Name, string PhoneNumber, DateTimeOffset CreatedAt);
public record DeliveryRunnerWithStatusDto(Guid Id, Guid ShopId, string Name, string PhoneNumber, bool IsAvailable, Guid? CurrentOrderId, string? CurrentOrderNumber);
