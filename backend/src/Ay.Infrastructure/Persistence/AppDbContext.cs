using Ay.Domain.Entities;
using Ay.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Ay.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<DeviceToken> DeviceTokens => Set<DeviceToken>();
    public DbSet<MerchantAccount> MerchantAccounts => Set<MerchantAccount>();
    public DbSet<Shop> Shops => Set<Shop>();
    public DbSet<CategoryTemplate> CategoryTemplates => Set<CategoryTemplate>();
    public DbSet<MerchantCategory> MerchantCategories => Set<MerchantCategory>();
    public DbSet<ItemTemplate> ItemTemplates => Set<ItemTemplate>();
    public DbSet<MerchantItem> MerchantItems => Set<MerchantItem>();
    public DbSet<MerchantItemCategory> MerchantItemCategories => Set<MerchantItemCategory>();
    public DbSet<ShopDeliveryLogic> ShopDeliveryLogics => Set<ShopDeliveryLogic>();
    public DbSet<DeliveryRunner> DeliveryRunners => Set<DeliveryRunner>();
    public DbSet<ConsumerAddress> ConsumerAddresses => Set<ConsumerAddress>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<NotificationPreference> NotificationPreferences => Set<NotificationPreference>();
    public DbSet<ShopDeliveryArea> ShopDeliveryAreas => Set<ShopDeliveryArea>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<UserProfile>(e =>
        {
            e.ToTable("user_profiles");
            e.HasKey(p => p.Id);
            e.HasIndex(p => p.UserId).IsUnique();
            e.Property(p => p.Role)
                .HasConversion(
                    v => v.ToString().ToLower(),
                    v => Enum.Parse<Domain.Enums.UserRole>(v, true))
                .HasMaxLength(20);
            e.Property(p => p.PhoneNumber).HasMaxLength(20);
            e.Property(p => p.CreatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.Property(p => p.UpdatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.HasOne<AppUser>()
                .WithOne()
                .HasForeignKey<UserProfile>(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<DeviceToken>(e =>
        {
            e.ToTable("device_tokens");
            e.HasKey(d => d.Id);
            e.HasIndex(d => d.Token).IsUnique();
            e.HasIndex(d => d.UserId);
            e.Property(d => d.Platform).HasMaxLength(10);
            e.Property(d => d.Token).HasMaxLength(500);
            e.Property(d => d.CreatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.Property(d => d.UpdatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.HasOne<AppUser>()
                .WithMany()
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<MerchantAccount>(e =>
        {
            e.ToTable("merchant_accounts");
            e.HasKey(m => m.Id);
            e.HasIndex(m => m.UserId).IsUnique();
            e.Property(m => m.ShopType).HasMaxLength(20);
            e.Property(m => m.NumberOfShops).HasMaxLength(5);
            e.Property(m => m.Status).HasMaxLength(20).HasDefaultValue("none");
            e.Property(m => m.CreatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.Property(m => m.UpdatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.HasOne<AppUser>()
                .WithOne()
                .HasForeignKey<MerchantAccount>(m => m.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Shop>(e =>
        {
            e.ToTable("shops");
            e.HasKey(s => s.Id);
            e.HasIndex(s => s.MerchantId);
            e.Property(s => s.Name).HasMaxLength(200);
            e.Property(s => s.Description).HasMaxLength(2000);
            e.Property(s => s.ShopType).HasMaxLength(20);
            e.Property(s => s.Address).HasMaxLength(500);
            e.Property(s => s.IsOpen).HasDefaultValue(true);
            e.Property(s => s.OpenStatusMode).HasMaxLength(20).HasDefaultValue("auto");
            e.Property(s => s.OpeningHours).HasColumnType("jsonb");
            e.Property(s => s.Holidays).HasColumnType("jsonb");
            e.Property(s => s.Tags).HasColumnType("text[]");
            e.Property(s => s.CreatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.Property(s => s.UpdatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.HasOne(s => s.MerchantAccount)
                .WithMany(m => m.Shops)
                .HasForeignKey(s => s.MerchantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<CategoryTemplate>(e =>
        {
            e.ToTable("category_templates");
            e.HasKey(c => c.Id);
            e.Property(c => c.Name).HasMaxLength(100);
            e.Property(c => c.CreatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.Property(c => c.UpdatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
        });

        builder.Entity<MerchantCategory>(e =>
        {
            e.ToTable("merchant_categories");
            e.HasKey(c => c.Id);
            e.Property(c => c.Name).HasMaxLength(100);
            e.Property(c => c.IsCustom).HasDefaultValue(true);
            e.Property(c => c.IsActive).HasDefaultValue(true);
            e.Property(c => c.CreatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.Property(c => c.UpdatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.HasOne(c => c.Shop)
                .WithMany(s => s.Categories)
                .HasForeignKey(c => c.ShopId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(c => c.Template)
                .WithMany()
                .HasForeignKey(c => c.TemplateId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<ItemTemplate>(e =>
        {
            e.ToTable("item_templates");
            e.HasKey(i => i.Id);
            e.Property(i => i.Name).HasMaxLength(200);
            e.HasIndex(i => i.NameNormalized).IsUnique();
            e.Property(i => i.CreatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.Property(i => i.UpdatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
        });

        builder.Entity<MerchantItem>(e =>
        {
            e.ToTable("merchant_items");
            e.HasKey(i => i.Id);
            e.HasIndex(i => i.ShopId);
            e.HasIndex(i => new { i.ShopId, i.IsActive });
            e.Property(i => i.Name).HasMaxLength(200);
            e.Property(i => i.PriceCents).HasDefaultValue(0);
            e.Property(i => i.Currency).HasMaxLength(5).HasDefaultValue("PKR");
            e.Property(i => i.IsActive).HasDefaultValue(true);
            e.Property(i => i.IsCustom).HasDefaultValue(true);
            e.Property(i => i.TimesSold).HasDefaultValue(0);
            e.Property(i => i.TotalRevenueCents).HasDefaultValue(0L);
            e.Property(i => i.LastUpdatedBy).HasColumnType("jsonb");
            e.Property(i => i.CreatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.Property(i => i.UpdatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.HasOne(i => i.Shop)
                .WithMany(s => s.Items)
                .HasForeignKey(i => i.ShopId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(i => i.Template)
                .WithMany()
                .HasForeignKey(i => i.TemplateId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasOne<AppUser>()
                .WithMany()
                .HasForeignKey(i => i.CreatedBy)
                .OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<MerchantItemCategory>(e =>
        {
            e.ToTable("merchant_item_categories");
            e.HasKey(ic => new { ic.MerchantItemId, ic.MerchantCategoryId });
            e.Property(ic => ic.SortOrder).HasDefaultValue(0);
            e.HasOne(ic => ic.MerchantItem)
                .WithMany(i => i.ItemCategories)
                .HasForeignKey(ic => ic.MerchantItemId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(ic => ic.MerchantCategory)
                .WithMany(c => c.ItemCategories)
                .HasForeignKey(ic => ic.MerchantCategoryId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ShopDeliveryLogic>(e =>
        {
            e.ToTable("shop_delivery_logic");
            e.HasKey(d => d.Id);
            e.HasIndex(d => d.ShopId).IsUnique();
            e.Property(d => d.MinimumOrderValue).HasColumnType("numeric").HasDefaultValue(200m);
            e.Property(d => d.SmallOrderSurcharge).HasColumnType("numeric").HasDefaultValue(40m);
            e.Property(d => d.LeastOrderValue).HasColumnType("numeric").HasDefaultValue(100m);
            e.Property(d => d.DistanceMode).HasMaxLength(10).HasDefaultValue("auto");
            e.Property(d => d.MaxDeliveryFee).HasColumnType("numeric").HasDefaultValue(130m);
            e.Property(d => d.DistanceTiers).HasColumnType("jsonb");
            e.Property(d => d.BeyondTierFeePerUnit).HasColumnType("numeric").HasDefaultValue(10m);
            e.Property(d => d.BeyondTierDistanceUnit).HasColumnType("numeric").HasDefaultValue(250m);
            e.Property(d => d.FreeDeliveryThreshold).HasColumnType("numeric").HasDefaultValue(800m);
            e.Property(d => d.FreeDeliveryRadius).HasColumnType("numeric").HasDefaultValue(1000m);
            e.Property(d => d.CreatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.Property(d => d.UpdatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.HasOne(d => d.Shop)
                .WithOne(s => s.DeliveryLogic)
                .HasForeignKey<ShopDeliveryLogic>(d => d.ShopId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<DeliveryRunner>(e =>
        {
            e.ToTable("delivery_runners");
            e.HasKey(r => r.Id);
            e.Property(r => r.Name).HasMaxLength(100);
            e.Property(r => r.PhoneNumber).HasMaxLength(20);
            e.Property(r => r.CreatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.Property(r => r.UpdatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.HasOne(r => r.Shop)
                .WithMany(s => s.Runners)
                .HasForeignKey(r => r.ShopId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ConsumerAddress>(e =>
        {
            e.ToTable("consumer_addresses");
            e.HasKey(a => a.Id);
            e.HasIndex(a => a.UserId);
            e.Property(a => a.Latitude).HasColumnType("numeric");
            e.Property(a => a.Longitude).HasColumnType("numeric");
            e.Property(a => a.CreatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.Property(a => a.UpdatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.HasOne<AppUser>()
                .WithMany()
                .HasForeignKey(a => a.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Order>(e =>
        {
            e.ToTable("orders");
            e.HasKey(o => o.Id);
            e.HasIndex(o => o.OrderNumber).IsUnique();
            e.HasIndex(o => o.UserId);
            e.HasIndex(o => o.ShopId);
            e.HasIndex(o => o.Status);
            e.HasIndex(o => new { o.ShopId, o.PlacedAt });
            e.Property(o => o.OrderNumber).HasMaxLength(20);
            e.Property(o => o.Status).HasMaxLength(20).HasDefaultValue("pending");
            e.Property(o => o.PaymentMethod).HasMaxLength(10).HasDefaultValue("cash");
            e.Property(o => o.DeliveryAddress).HasColumnType("jsonb");
            e.Property(o => o.PlacedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.Property(o => o.CreatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.Property(o => o.UpdatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.HasOne(o => o.Shop)
                .WithMany()
                .HasForeignKey(o => o.ShopId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasOne<AppUser>()
                .WithMany()
                .HasForeignKey(o => o.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(o => o.DeliveryRunner)
                .WithMany()
                .HasForeignKey(o => o.DeliveryRunnerId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<OrderItem>(e =>
        {
            e.ToTable("order_items");
            e.HasKey(oi => oi.Id);
            e.Property(oi => oi.ItemName).HasMaxLength(200);
            e.Property(oi => oi.CreatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.HasOne(oi => oi.Order)
                .WithMany(o => o.OrderItems)
                .HasForeignKey(oi => oi.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(oi => oi.MerchantItem)
                .WithMany()
                .HasForeignKey(oi => oi.MerchantItemId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<Review>(e =>
        {
            e.ToTable("reviews");
            e.HasKey(r => r.Id);
            e.Property(r => r.CreatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.Property(r => r.UpdatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.HasOne<AppUser>()
                .WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Shop>()
                .WithMany()
                .HasForeignKey(r => r.ShopId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<AuditLog>(e =>
        {
            e.ToTable("audit_logs");
            e.HasKey(a => a.Id);
            e.Property(a => a.Actor).HasColumnType("jsonb");
            e.Property(a => a.ChangedFields).HasColumnType("jsonb");
            e.Property(a => a.ActionType).HasMaxLength(50);
            e.Property(a => a.Source).HasMaxLength(20).HasDefaultValue("manual");
            e.Property(a => a.CreatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.HasOne<Shop>()
                .WithMany()
                .HasForeignKey(a => a.ShopId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne<MerchantItem>()
                .WithMany()
                .HasForeignKey(a => a.MerchantItemId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<NotificationPreference>(e =>
        {
            e.ToTable("notification_preferences");
            e.HasKey(n => n.Id);
            e.HasIndex(n => new { n.UserId, n.Role }).IsUnique();
            e.Property(n => n.Role).HasMaxLength(20);
            e.Property(n => n.AllowPushNotifications).HasDefaultValue(true);
            e.Property(n => n.CreatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.Property(n => n.UpdatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.HasOne<AppUser>()
                .WithMany()
                .HasForeignKey(n => n.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ShopDeliveryArea>(e =>
        {
            e.ToTable("shop_delivery_areas");
            e.HasKey(a => a.Id);
            e.Property(a => a.Label).HasMaxLength(200);
            e.Property(a => a.Geom).HasColumnType("geometry").IsRequired();
            e.Property(a => a.CreatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.Property(a => a.UpdatedAt).HasDefaultValueSql("NOW() AT TIME ZONE 'utc'");
            e.HasOne(a => a.Shop)
                .WithMany(s => s.DeliveryAreas)
                .HasForeignKey(a => a.ShopId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.HasSequence<long>("order_number_seq").StartsAt(1000).IncrementsBy(1);
    }
}
