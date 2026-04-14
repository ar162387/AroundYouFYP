using System;
using System.Text.Json;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ay.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMerchantTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "order_number_seq",
                startValue: 1000L);

            migrationBuilder.CreateTable(
                name: "category_templates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_category_templates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "consumer_addresses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: true),
                    StreetAddress = table.Column<string>(type: "text", nullable: false),
                    City = table.Column<string>(type: "text", nullable: false),
                    Region = table.Column<string>(type: "text", nullable: true),
                    Latitude = table.Column<decimal>(type: "numeric", nullable: false),
                    Longitude = table.Column<decimal>(type: "numeric", nullable: false),
                    Landmark = table.Column<string>(type: "text", nullable: true),
                    FormattedAddress = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_consumer_addresses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_consumer_addresses_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "item_templates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Barcode = table.Column<string>(type: "text", nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    ImageUrl = table.Column<string>(type: "text", nullable: true),
                    DefaultUnit = table.Column<string>(type: "text", nullable: true),
                    NameNormalized = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_item_templates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "merchant_accounts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ShopType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    NumberOfShops = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "none"),
                    NameAsPerCnic = table.Column<string>(type: "text", nullable: true),
                    Cnic = table.Column<string>(type: "text", nullable: true),
                    CnicExpiry = table.Column<DateOnly>(type: "date", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_merchant_accounts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_merchant_accounts_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "shops",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MerchantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    ShopType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Latitude = table.Column<double>(type: "double precision", nullable: false),
                    Longitude = table.Column<double>(type: "double precision", nullable: false),
                    ImageUrl = table.Column<string>(type: "text", nullable: true),
                    Tags = table.Column<string[]>(type: "text[]", nullable: false),
                    IsOpen = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    OpeningHours = table.Column<JsonDocument>(type: "jsonb", nullable: true),
                    Holidays = table.Column<JsonDocument>(type: "jsonb", nullable: true),
                    OpenStatusMode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "auto"),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shops", x => x.Id);
                    table.ForeignKey(
                        name: "FK_shops_merchant_accounts_MerchantId",
                        column: x => x.MerchantId,
                        principalTable: "merchant_accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "delivery_runners",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ShopId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    PhoneNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_delivery_runners", x => x.Id);
                    table.ForeignKey(
                        name: "FK_delivery_runners_shops_ShopId",
                        column: x => x.ShopId,
                        principalTable: "shops",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "merchant_categories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ShopId = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: true),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    IsCustom = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_merchant_categories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_merchant_categories_category_templates_TemplateId",
                        column: x => x.TemplateId,
                        principalTable: "category_templates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_merchant_categories_shops_ShopId",
                        column: x => x.ShopId,
                        principalTable: "shops",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "merchant_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ShopId = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: true),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Barcode = table.Column<string>(type: "text", nullable: true),
                    ImageUrl = table.Column<string>(type: "text", nullable: true),
                    Sku = table.Column<string>(type: "text", nullable: true),
                    PriceCents = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    Currency = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false, defaultValue: "PKR"),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    IsCustom = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    LastUpdatedBy = table.Column<JsonDocument>(type: "jsonb", nullable: true),
                    TimesSold = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    TotalRevenueCents = table.Column<long>(type: "bigint", nullable: false, defaultValue: 0L),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_merchant_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_merchant_items_AspNetUsers_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_merchant_items_item_templates_TemplateId",
                        column: x => x.TemplateId,
                        principalTable: "item_templates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_merchant_items_shops_ShopId",
                        column: x => x.ShopId,
                        principalTable: "shops",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "reviews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ShopId = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: true),
                    Rating = table.Column<int>(type: "integer", nullable: false),
                    ReviewText = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reviews", x => x.Id);
                    table.ForeignKey(
                        name: "FK_reviews_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reviews_shops_ShopId",
                        column: x => x.ShopId,
                        principalTable: "shops",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "shop_delivery_logic",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ShopId = table.Column<Guid>(type: "uuid", nullable: false),
                    MinimumOrderValue = table.Column<decimal>(type: "numeric", nullable: false, defaultValue: 200m),
                    SmallOrderSurcharge = table.Column<decimal>(type: "numeric", nullable: false, defaultValue: 40m),
                    LeastOrderValue = table.Column<decimal>(type: "numeric", nullable: false, defaultValue: 100m),
                    DistanceMode = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false, defaultValue: "auto"),
                    MaxDeliveryFee = table.Column<decimal>(type: "numeric", nullable: false, defaultValue: 130m),
                    DistanceTiers = table.Column<JsonDocument>(type: "jsonb", nullable: true),
                    BeyondTierFeePerUnit = table.Column<decimal>(type: "numeric", nullable: false, defaultValue: 10m),
                    BeyondTierDistanceUnit = table.Column<decimal>(type: "numeric", nullable: false, defaultValue: 250m),
                    FreeDeliveryThreshold = table.Column<decimal>(type: "numeric", nullable: false, defaultValue: 800m),
                    FreeDeliveryRadius = table.Column<decimal>(type: "numeric", nullable: false, defaultValue: 1000m),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shop_delivery_logic", x => x.Id);
                    table.ForeignKey(
                        name: "FK_shop_delivery_logic_shops_ShopId",
                        column: x => x.ShopId,
                        principalTable: "shops",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "orders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ShopId = table.Column<Guid>(type: "uuid", nullable: true),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ConsumerAddressId = table.Column<Guid>(type: "uuid", nullable: false),
                    DeliveryRunnerId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "pending"),
                    SubtotalCents = table.Column<int>(type: "integer", nullable: false),
                    DeliveryFeeCents = table.Column<int>(type: "integer", nullable: false),
                    SurchargeCents = table.Column<int>(type: "integer", nullable: false),
                    TotalCents = table.Column<int>(type: "integer", nullable: false),
                    PaymentMethod = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false, defaultValue: "cash"),
                    SpecialInstructions = table.Column<string>(type: "text", nullable: true),
                    PlacedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'"),
                    ConfirmedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    OutForDeliveryAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    DeliveredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CancelledAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ConfirmationTimeSeconds = table.Column<int>(type: "integer", nullable: true),
                    PreparationTimeSeconds = table.Column<int>(type: "integer", nullable: true),
                    DeliveryTimeSeconds = table.Column<int>(type: "integer", nullable: true),
                    CancellationReason = table.Column<string>(type: "text", nullable: true),
                    CancelledBy = table.Column<Guid>(type: "uuid", nullable: true),
                    DeliveryAddress = table.Column<JsonDocument>(type: "jsonb", nullable: false),
                    CustomerName = table.Column<string>(type: "text", nullable: true),
                    CustomerEmail = table.Column<string>(type: "text", nullable: true),
                    CustomerPhone = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_orders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_orders_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_orders_delivery_runners_DeliveryRunnerId",
                        column: x => x.DeliveryRunnerId,
                        principalTable: "delivery_runners",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_orders_shops_ShopId",
                        column: x => x.ShopId,
                        principalTable: "shops",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "audit_logs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ShopId = table.Column<Guid>(type: "uuid", nullable: false),
                    MerchantItemId = table.Column<Guid>(type: "uuid", nullable: true),
                    Actor = table.Column<JsonDocument>(type: "jsonb", nullable: false),
                    ActionType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ChangedFields = table.Column<JsonDocument>(type: "jsonb", nullable: false),
                    Source = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "manual"),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_logs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_audit_logs_merchant_items_MerchantItemId",
                        column: x => x.MerchantItemId,
                        principalTable: "merchant_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_audit_logs_shops_ShopId",
                        column: x => x.ShopId,
                        principalTable: "shops",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "merchant_item_categories",
                columns: table => new
                {
                    MerchantItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    MerchantCategoryId = table.Column<Guid>(type: "uuid", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_merchant_item_categories", x => new { x.MerchantItemId, x.MerchantCategoryId });
                    table.ForeignKey(
                        name: "FK_merchant_item_categories_merchant_categories_MerchantCatego~",
                        column: x => x.MerchantCategoryId,
                        principalTable: "merchant_categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_merchant_item_categories_merchant_items_MerchantItemId",
                        column: x => x.MerchantItemId,
                        principalTable: "merchant_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "order_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    MerchantItemId = table.Column<Guid>(type: "uuid", nullable: true),
                    ItemName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ItemDescription = table.Column<string>(type: "text", nullable: true),
                    ItemImageUrl = table.Column<string>(type: "text", nullable: true),
                    ItemPriceCents = table.Column<int>(type: "integer", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    SubtotalCents = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'utc'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_order_items_merchant_items_MerchantItemId",
                        column: x => x.MerchantItemId,
                        principalTable: "merchant_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_order_items_orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_audit_logs_MerchantItemId",
                table: "audit_logs",
                column: "MerchantItemId");

            migrationBuilder.CreateIndex(
                name: "IX_audit_logs_ShopId",
                table: "audit_logs",
                column: "ShopId");

            migrationBuilder.CreateIndex(
                name: "IX_consumer_addresses_UserId",
                table: "consumer_addresses",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_delivery_runners_ShopId",
                table: "delivery_runners",
                column: "ShopId");

            migrationBuilder.CreateIndex(
                name: "IX_item_templates_NameNormalized",
                table: "item_templates",
                column: "NameNormalized",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_merchant_accounts_UserId",
                table: "merchant_accounts",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_merchant_categories_ShopId",
                table: "merchant_categories",
                column: "ShopId");

            migrationBuilder.CreateIndex(
                name: "IX_merchant_categories_TemplateId",
                table: "merchant_categories",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_merchant_item_categories_MerchantCategoryId",
                table: "merchant_item_categories",
                column: "MerchantCategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_merchant_items_CreatedBy",
                table: "merchant_items",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_merchant_items_ShopId",
                table: "merchant_items",
                column: "ShopId");

            migrationBuilder.CreateIndex(
                name: "IX_merchant_items_ShopId_IsActive",
                table: "merchant_items",
                columns: new[] { "ShopId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_merchant_items_TemplateId",
                table: "merchant_items",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_order_items_MerchantItemId",
                table: "order_items",
                column: "MerchantItemId");

            migrationBuilder.CreateIndex(
                name: "IX_order_items_OrderId",
                table: "order_items",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_orders_DeliveryRunnerId",
                table: "orders",
                column: "DeliveryRunnerId");

            migrationBuilder.CreateIndex(
                name: "IX_orders_OrderNumber",
                table: "orders",
                column: "OrderNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_orders_ShopId",
                table: "orders",
                column: "ShopId");

            migrationBuilder.CreateIndex(
                name: "IX_orders_ShopId_PlacedAt",
                table: "orders",
                columns: new[] { "ShopId", "PlacedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_orders_Status",
                table: "orders",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_orders_UserId",
                table: "orders",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_reviews_ShopId",
                table: "reviews",
                column: "ShopId");

            migrationBuilder.CreateIndex(
                name: "IX_reviews_UserId",
                table: "reviews",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_shop_delivery_logic_ShopId",
                table: "shop_delivery_logic",
                column: "ShopId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_shops_MerchantId",
                table: "shops",
                column: "MerchantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "audit_logs");

            migrationBuilder.DropTable(
                name: "consumer_addresses");

            migrationBuilder.DropTable(
                name: "merchant_item_categories");

            migrationBuilder.DropTable(
                name: "order_items");

            migrationBuilder.DropTable(
                name: "reviews");

            migrationBuilder.DropTable(
                name: "shop_delivery_logic");

            migrationBuilder.DropTable(
                name: "merchant_categories");

            migrationBuilder.DropTable(
                name: "merchant_items");

            migrationBuilder.DropTable(
                name: "orders");

            migrationBuilder.DropTable(
                name: "category_templates");

            migrationBuilder.DropTable(
                name: "item_templates");

            migrationBuilder.DropTable(
                name: "delivery_runners");

            migrationBuilder.DropTable(
                name: "shops");

            migrationBuilder.DropTable(
                name: "merchant_accounts");

            migrationBuilder.DropSequence(
                name: "order_number_seq");
        }
    }
}
