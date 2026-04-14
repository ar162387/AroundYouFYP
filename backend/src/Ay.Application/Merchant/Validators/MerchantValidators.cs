using Ay.Application.Merchant.DTOs;
using FluentValidation;

namespace Ay.Application.Merchant.Validators;

public class CreateMerchantAccountRequestValidator : AbstractValidator<CreateMerchantAccountRequest>
{
    public CreateMerchantAccountRequestValidator()
    {
        RuleFor(x => x.ShopType).NotEmpty().Must(t => t is "grocery" or "meat" or "vegetable" or "mart" or "other").WithMessage("ShopType must be one of: grocery, meat, vegetable, mart, other.");
        RuleFor(x => x.NumberOfShops).NotEmpty().Must(n => n is "1" or "2" or "3+").WithMessage("NumberOfShops must be 1, 2, or 3+.");
    }
}

public class UpdateMerchantAccountRequestValidator : AbstractValidator<UpdateMerchantAccountRequest>
{
    public UpdateMerchantAccountRequestValidator()
    {
        When(x => !string.IsNullOrWhiteSpace(x.NameAsPerCnic), () =>
        {
            RuleFor(x => x.NameAsPerCnic!)
                .MinimumLength(3)
                .Must(n => !n.Any(char.IsDigit))
                .WithMessage("Name as per CNIC must not contain numbers.");
        });

        When(x => x.CnicExpiry is not null, () =>
        {
            RuleFor(x => x.CnicExpiry!.Value)
                .Must(d => d >= DateOnly.FromDateTime(DateTime.UtcNow.Date))
                .WithMessage("CNIC expiry must be today or a future date.");
        });

        When(x => x.Status is not null, () =>
        {
            RuleFor(x => x.Status!)
                .Must(s => string.Equals(s.Trim(), "pending", StringComparison.OrdinalIgnoreCase))
                .WithMessage("Merchants may only set status to pending when submitting verification.");
        });
    }
}

public class CreateShopRequestValidator : AbstractValidator<CreateShopRequest>
{
    public CreateShopRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(2000);
        RuleFor(x => x.ShopType).NotEmpty().Must(t => t is "Grocery" or "Meat" or "Vegetable" or "Stationery" or "Dairy" or "Pharmacy").WithMessage("ShopType must be one of: Grocery, Meat, Vegetable, Stationery, Dairy, Pharmacy.");
        RuleFor(x => x.Address).NotEmpty().MaximumLength(500);
        RuleFor(x => x.Latitude).InclusiveBetween(-90, 90);
        RuleFor(x => x.Longitude).InclusiveBetween(-180, 180);
    }
}

public class CreateCategoryRequestValidator : AbstractValidator<CreateCategoryRequest>
{
    public CreateCategoryRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
    }
}

public class CreateItemRequestValidator : AbstractValidator<CreateItemRequest>
{
    public CreateItemRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.PriceCents).GreaterThanOrEqualTo(0);
    }
}

public class UpdateDeliveryLogicRequestValidator : AbstractValidator<UpdateDeliveryLogicRequest>
{
    public UpdateDeliveryLogicRequestValidator()
    {
        RuleFor(x => x.MinimumOrderValue).GreaterThan(0);
        RuleFor(x => x.SmallOrderSurcharge).GreaterThanOrEqualTo(0);
        RuleFor(x => x.LeastOrderValue).GreaterThan(0);
    }
}

public class CreateRunnerRequestValidator : AbstractValidator<CreateRunnerRequest>
{
    public CreateRunnerRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.PhoneNumber).NotEmpty().MaximumLength(20);
    }
}

public class DispatchOrderRequestValidator : AbstractValidator<DispatchOrderRequest>
{
    public DispatchOrderRequestValidator()
    {
        RuleFor(x => x.RunnerId).NotEmpty();
    }
}

public class CancelOrderRequestValidator : AbstractValidator<CancelOrderRequest>
{
    public CancelOrderRequestValidator()
    {
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(500);
    }
}
