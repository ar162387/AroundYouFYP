using Ay.Application.Consumer.DTOs;
using Ay.Domain.Entities;

namespace Ay.Application.Consumer.Services;

public interface IDeliveryFeeCalculatorService
{
    double CalculateDistance(double lat1, double lon1, double lat2, double lon2);
    OrderFeeBreakdown CalculateFee(decimal subtotalPkr, double distanceMeters, ShopDeliveryLogic logic);
}
