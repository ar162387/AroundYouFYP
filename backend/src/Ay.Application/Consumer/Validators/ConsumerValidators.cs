using Ay.Application.Consumer.DTOs;
using FluentValidation;

namespace Ay.Application.Consumer.Validators;

public class CreateAddressRequestValidator : AbstractValidator<CreateAddressRequest>
{
    public CreateAddressRequestValidator()
    {
        RuleFor(x => x.StreetAddress).NotEmpty().MaximumLength(500);
        RuleFor(x => x.City).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Latitude).InclusiveBetween(-90, 90);
        RuleFor(x => x.Longitude).InclusiveBetween(-180, 180);
    }
}

public class PlaceOrderRequestValidator : AbstractValidator<PlaceOrderRequest>
{
    public PlaceOrderRequestValidator()
    {
        RuleFor(x => x.ShopId).NotEmpty();
        RuleFor(x => x.ConsumerAddressId).NotEmpty();
        RuleFor(x => x.Items).NotEmpty().WithMessage("At least one item is required.");
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.MerchantItemId).NotEmpty();
            item.RuleFor(i => i.Quantity).GreaterThanOrEqualTo(1);
        });
        RuleFor(x => x.PaymentMethod).NotEmpty().Must(p => p is "cash" or "card" or "online");
    }
}

public class CalculateOrderRequestValidator : AbstractValidator<CalculateOrderRequest>
{
    public CalculateOrderRequestValidator()
    {
        RuleFor(x => x.ShopId).NotEmpty();
        RuleFor(x => x.ConsumerAddressId).NotEmpty();
        RuleFor(x => x.Items).NotEmpty();
    }
}

public class CreateReviewRequestValidator : AbstractValidator<CreateReviewRequest>
{
    public CreateReviewRequestValidator()
    {
        RuleFor(x => x.ShopId).NotEmpty();
        RuleFor(x => x.Rating).InclusiveBetween(1, 5);
        RuleFor(x => x.ReviewText).MaximumLength(500);
    }
}

public class UpdateConsumerProfileRequestValidator : AbstractValidator<UpdateConsumerProfileRequest>
{
    public UpdateConsumerProfileRequestValidator()
    {
        RuleFor(x => x.Name).MaximumLength(100);
    }
}
