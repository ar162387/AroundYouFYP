Architecture & Project Structure
Strict Clean Architecture: The solution must be divided into four distinct projects:

ProjectName.Domain: Entities, Enums, Exceptions, and Repository Interfaces (Zero dependencies).

ProjectName.Application: DTOs, Mapping profiles, FluentValidation, and Service logic (Depends on Domain).

ProjectName.Infrastructure: EF Core DbContext, Migrations, External API clients (Depends on Application/Domain).

ProjectName.WebApi: Controllers, Middlewares, and Program.cs (Depends on Application/Infrastructure).

No Logic in Controllers: Controllers must be "thin." Their only job is to accept a request and return an IActionResult. All logic must reside in the Application layer.

Dependency Injection (DI): Every service and repository must be registered via Interfaces. Never instantiate classes using new inside other classes.


Coding Standards & Patterns
The Result Pattern: Do not throw exceptions for expected business failures (e.g., "User Not Found"). Instead, return a Result<T> or Result object that encapsulates success/failure and error messages.

Use ProblemDetails: Use the standard ProblemDetails (RFC 7807) for all API error responses to ensure the Web and Mobile apps handle errors consistently.

Async/Await Everywhere: Every database call, I/O operation, or external API call must be async. Never use .Result or .Wait().

Primary Constructors (C# 12+): Use primary constructors for dependency injection to keep classes concise.

File-scoped Namespaces: Use namespace MyProject.Domain; instead of the older curly-bracket style to reduce indentation.

Data & Security (Supabase Migration Focus)
EF Core & Npgsql: Since you are likely moving from Supabase (Postgres), use Entity Framework Core with the Npgsql provider. Use the Fluent API in OnModelCreating rather than Data Annotations on Entities for better separation.

ASP.NET Core Identity: Replace Supabase Auth with standard ASP.NET Core Identity. Use JWT (JSON Web Tokens) for authentication, ensuring the mobile app can store the token securely.

DTO Mapping: Use a mapping library (like AutoMapper or Mapster) to convert Entities to DTOs. Never return a database Entity directly to the API consumer.


Web & Mobile API Design
API Versioning: Implement URL-based versioning (e.g., /api/v1/users). This is critical for mobile apps so you don't break old app versions when you update the backend.

Global Error Handling: Implement a custom Middleware or an IExceptionHandler (ASP.NET Core 8+) to catch unhandled exceptions and log them without leaking sensitive info to the client.

FluentValidation: All incoming requests must be validated using FluentValidation before reaching the service logic.

Environment Secrets: Use appsettings.json for non-sensitive config and User Secrets or Environment Variables for connection strings and API keys. Never hardcode strings.


Rule: Standardized Paths

Directive: "Never use absolute paths (like C:\Users\...). Use IWebHostEnvironment.ContentRootPath or Path.Combine(Directory.GetCurrentDirectory(), "Uploads") so the file system logic works on both your local machine and the VPS's Linux file system."


Implement SignalR for real-time updates . Ensure the SignalR hub is CORS-configured to allow both your Web frontend and your Mobile app .