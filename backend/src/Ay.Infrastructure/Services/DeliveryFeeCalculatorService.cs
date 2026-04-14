using System.Text.Json;
using Ay.Application.Consumer.DTOs;
using Ay.Application.Consumer.Services;
using Ay.Domain.Entities;

namespace Ay.Infrastructure.Services;

public class DeliveryFeeCalculatorService : IDeliveryFeeCalculatorService
{
    public double CalculateDistance(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371000;
        var dLat = ToRad(lat2 - lat1);
        var dLon = ToRad(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    public OrderFeeBreakdown CalculateFee(decimal subtotalPkr, double distanceMeters, ShopDeliveryLogic logic)
    {
        if (subtotalPkr >= logic.FreeDeliveryThreshold && (decimal)distanceMeters <= logic.FreeDeliveryRadius)
        {
            var surchargeForFree = subtotalPkr < logic.MinimumOrderValue ? (int)(logic.SmallOrderSurcharge * 100) : 0;
            return new OrderFeeBreakdown(0, surchargeForFree, true, distanceMeters);
        }

        var tiers = new List<(decimal maxDist, decimal fee)>();
        if (logic.DistanceTiers is not null)
        {
            foreach (var el in logic.DistanceTiers.RootElement.EnumerateArray())
            {
                tiers.Add((el.GetProperty("max_distance").GetDecimal(), el.GetProperty("fee").GetDecimal()));
            }
            tiers.Sort((a, b) => a.maxDist.CompareTo(b.maxDist));
        }

        decimal baseFee = 0;
        bool matched = false;
        foreach (var tier in tiers)
        {
            if ((decimal)distanceMeters <= tier.maxDist)
            {
                baseFee = Math.Min(tier.fee, logic.MaxDeliveryFee);
                matched = true;
                break;
            }
        }

        if (!matched && tiers.Count > 0)
        {
            var last = tiers[^1];
            var extra = (decimal)distanceMeters - last.maxDist;
            var units = Math.Ceiling(extra / logic.BeyondTierDistanceUnit);
            baseFee = Math.Min(last.fee + units * logic.BeyondTierFeePerUnit, logic.MaxDeliveryFee);
        }

        int deliveryFeeCents = (int)(baseFee * 100);
        int surchargeCents = subtotalPkr < logic.MinimumOrderValue ? (int)(logic.SmallOrderSurcharge * 100) : 0;

        return new OrderFeeBreakdown(deliveryFeeCents, surchargeCents, false, distanceMeters);
    }

    private static double ToRad(double deg) => deg * Math.PI / 180;
}
