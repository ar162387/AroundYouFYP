namespace Ay.Application.Consumer.DTOs;

public record OrderFeeBreakdown(int DeliveryFeeCents, int SurchargeCents, bool FreeDeliveryApplied, double DistanceMeters);
