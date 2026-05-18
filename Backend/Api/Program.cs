using Api.Workers;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using Pgvector.EntityFrameworkCore;
using Repository.Data;
using Service.Configuration;
using Service.Implementations;
using Service.Interfaces;
using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

var isRailway = !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("RAILWAY_PROJECT_ID")) ||
                !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("RAILWAY_ENVIRONMENT"));
var platformPort = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(platformPort) && int.TryParse(platformPort, out var parsedPort))
{
    // Railway cung cấp dynamic PORT, cần bind đúng để tránh healthcheck fail/restart loop.
    builder.WebHost.UseUrls($"http://0.0.0.0:{parsedPort}");
}

// Tắt reloadOnChange cho config files để tránh lỗi inotify limit trên Linux (Render)
// "The configured user limit (1024) on the number of inotify instances has been reached"
// ASP.NET Core mặc định dùng FileSystemWatcher để watch appsettings.json → tốn inotify instances
builder.Configuration.Sources
    .OfType<Microsoft.Extensions.Configuration.Json.JsonConfigurationSource>()
    .ToList()
    .ForEach(s => s.ReloadOnChange = false);

// Add services to the container.
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning));
    var rawConn = builder.Configuration.GetConnectionString("DefaultConnection");
    if (string.IsNullOrWhiteSpace(rawConn))
        throw new InvalidOperationException("Missing connection string: ConnectionStrings:DefaultConnection");

    // Supabase pooler (pgBouncer) needs a few Npgsql knobs to be stable.
    // We apply safe defaults only when the host indicates pooler usage.
    var csb = new NpgsqlConnectionStringBuilder(rawConn);
    var host = csb.Host ?? string.Empty;
    if (host.Contains("pooler.supabase.com", StringComparison.OrdinalIgnoreCase))
    {
        // Supabase pooler requires SSL.
        if (csb.SslMode == SslMode.Disable)
            csb.SslMode = SslMode.Require;

        // Required for pgBouncer transaction pooling.
        csb.NoResetOnClose = true;

        // Keep the TCP connection warm; reduce "connection reset by peer".
        csb.KeepAlive = csb.KeepAlive <= 0 ? 30 : csb.KeepAlive;

        // Fail fast on bad network; EF has retry-on-failure.
        csb.Timeout = csb.Timeout <= 0 ? 15 : csb.Timeout;
        csb.CommandTimeout = csb.CommandTimeout <= 0 ? 30 : csb.CommandTimeout;

        // Reasonable pool cap for web API
        csb.MaxPoolSize = csb.MaxPoolSize <= 0 ? 50 : csb.MaxPoolSize;
    }

    options.UseNpgsql(csb.ConnectionString,
        npgsqlOptions =>
        {
            npgsqlOptions.EnableRetryOnFailure(
                maxRetryCount: 3,
                maxRetryDelay: TimeSpan.FromSeconds(5),
                errorCodesToAdd: null);
            npgsqlOptions.UseVector();
        });
});


// Removed default OpenApi in favor of Swashbuckle

builder.Services.AddControllers();

// Add CORS Policy
// In production only allow the real frontend domains; localhost origins are added in development only.
var corsOrigins = builder.Configuration["Cors:AllowedOrigins"]
    ?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    ?? [];
var productionOrigins = new[]
{
    "https://www.storynest.cloud",
    "https://storynest.cloud"
};
var developmentOrigins = new[]
{
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000"
};
var allOrigins = (builder.Environment.IsDevelopment()
    ? productionOrigins.Concat(developmentOrigins)
    : productionOrigins)
    .Union(corsOrigins)
    .ToArray();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(allOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Add Swagger with JWT Support
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo { Title = "StoryRAG API", Version = "v1" });

    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Nhập Token"
    });

    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[] {}
        }
    });
});

// Add Service Registration
builder.Services.AddRequestTimeouts(options =>
    options.AddPolicy("LongRunning", TimeSpan.FromMinutes(10)));

// Rate Limiting — giới hạn request đến AI endpoints, chống bot và abuse
builder.Services.AddRateLimiter(options =>
{
    // Custom 429 response với Retry-After header
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Response.Headers["Retry-After"] = "60";
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            Message = "Bạn đang gửi quá nhiều yêu cầu. Vui lòng thử lại sau.",
            RetryAfterSeconds = 60,
            Code = "RATE_LIMIT_EXCEEDED"
        }, token);
    };

    // SlidingWindow tránh burst tại ranh giới window
    // Chat: tối đa 20 requests / phút / user
    options.AddSlidingWindowLimiter("AiChat", opt =>
    {
        opt.PermitLimit = 20;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.SegmentsPerWindow = 4;
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 0;
    });

    // Rewrite: tối đa 15 requests / phút / user
    options.AddSlidingWindowLimiter("AiRewrite", opt =>
    {
        opt.PermitLimit = 15;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.SegmentsPerWindow = 4;
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 0;
    });

    // Analyze: tối đa 3 requests / 10 phút / user (operation nặng)
    options.AddSlidingWindowLimiter("AiAnalyze", opt =>
    {
        opt.PermitLimit = 3;
        opt.Window = TimeSpan.FromMinutes(10);
        opt.SegmentsPerWindow = 5;
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 0;
    });

    // Embed: tối đa 30 requests / phút / user
    options.AddSlidingWindowLimiter("AiEmbed", opt =>
    {
        opt.PermitLimit = 30;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.SegmentsPerWindow = 4;
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 0;
    });

    // Auth login: tối đa 5 attempts / 15 phút / IP + email
    options.AddPolicy("AuthLogin", context =>
    {
        var key = GetAuthLoginPartitionKey(context);
        return RateLimitPartition.GetSlidingWindowLimiter(
            partitionKey: key,
            factory: _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(15),
                SegmentsPerWindow = 5,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
            });
    });
});
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IAdminService, AdminService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IProjectService, ProjectService>();
builder.Services.AddScoped<IGenreService, GenreService>();
builder.Services.AddScoped<ISubscriptionService, SubscriptionService>();
builder.Services.AddScoped<IPaymentService, PaymentService>();
builder.Services.AddSingleton<IChunkingService, ChunkingService>();
builder.Services.AddScoped<IChapterService, ChapterService>();
builder.Services.AddScoped<IEmbeddingService, EmbeddingService>();
builder.Services.AddScoped<IAiChatService, AiChatService>();
builder.Services.AddScoped<IProjectReportService, ProjectReportService>();
builder.Services.AddScoped<IUserSettingsService, UserSettingsService>();
builder.Services.AddScoped<IWorldbuildingService, WorldbuildingService>();
builder.Services.AddScoped<ICharacterService, CharacterService>();
builder.Services.AddScoped<ICharacterRelationshipService, CharacterRelationshipService>();
builder.Services.AddScoped<IAiRewriteService, AiRewriteService>();
builder.Services.AddScoped<IAiWritingService, AiWritingService>();
builder.Services.AddScoped<IBugReportService, BugReportService>();
builder.Services.AddScoped<IStaffService, StaffService>();
builder.Services.AddScoped<ISupportWorkflowService, SupportWorkflowService>();
builder.Services.AddScoped<IStyleGuideService, StyleGuideService>();
builder.Services.AddScoped<IThemeService, ThemeService>();
builder.Services.AddScoped<IPlotNoteService, PlotNoteService>();
builder.Services.AddScoped<IAiAnalysisHistoryService, AiAnalysisHistoryService>();
builder.Services.AddScoped<ITimelineEventService, TimelineEventService>();
builder.Services.AddScoped<IExportService, ExportService>();
builder.Services.AddScoped<INarrativeAnalyticsService, NarrativeAnalyticsService>();
builder.Services.AddScoped<IReportExportService, ReportExportService>();
builder.Services.AddScoped<IProjectAnalysisJobService, ProjectAnalysisJobService>();
builder.Services.AddScoped<IProjectImportService, ProjectImportService>();
builder.Services.AddSingleton<IAnalysisJobQueue, AnalysisJobQueue>();
builder.Services.AddSingleton<IAnalysisJobCancellationRegistry, AnalysisJobCancellationRegistry>();
builder.Services.AddHostedService<ProjectAnalysisJobWorker>();
builder.Services.AddHostedService<AutoEmbeddingWorker>();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<ISystemConfigService, SystemConfigService>();
builder.Services.AddScoped<ISystemAuditLogService, SystemAuditLogService>();
builder.Services.Configure<VnPayOptions>(builder.Configuration.GetSection("VNPay"));

// Add Authentication Configuration
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] ?? "")),
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"],
            ClockSkew = TimeSpan.Zero
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

// Apply pending EF Core migrations on startup so new tables (e.g. StaffFeedbacks) exist before handling requests.
// Railway có thể restart liên tục khi DB chưa sẵn sàng ở lúc boot; mặc định tắt auto-migrate trên Railway.
var autoMigrateDefault = !app.Environment.IsDevelopment() && !isRailway;
var autoMigrateOnStartup = builder.Configuration.GetValue("Database:AutoMigrateOnStartup", autoMigrateDefault);
if (autoMigrateOnStartup)
{
    using (var scope = app.Services.CreateScope())
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("StartupMigration");
        try
        {
            dbContext.Database.Migrate();
        }
        catch (Exception ex) when (ContainsPostgresRelationExists(ex))
        {
            logger.LogWarning(ex,
                "Skip startup migration because schema objects already exist but EF history is out of sync. " +
                "Application will continue running.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to apply database migrations on startup.");
            throw;
        }
    }
}

static bool ContainsPostgresRelationExists(Exception ex)
{
    Exception? current = ex;
    while (current != null)
    {
        if (current is PostgresException pgEx && pgEx.SqlState == "42P07")
            return true;

        current = current.InnerException;
    }

    return false;
}

// Configure the HTTP request pipeline.
// Swagger is only available in development to avoid exposing API schema in production.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Render terminates SSL externally — do not redirect HTTP inside container
if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseRequestTimeouts();

app.Use(async (context, next) =>
{
    if (HttpMethods.IsPost(context.Request.Method) &&
        context.Request.Path.Equals("/api/auth/login", StringComparison.OrdinalIgnoreCase))
    {
        context.Request.EnableBuffering();
        using var reader = new StreamReader(context.Request.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: false, leaveOpen: true);
        var body = await reader.ReadToEndAsync();
        context.Request.Body.Position = 0;

        if (!string.IsNullOrWhiteSpace(body))
        {
            try
            {
                using var json = JsonDocument.Parse(body);
                if (json.RootElement.TryGetProperty("email", out var emailProp) &&
                    emailProp.ValueKind == JsonValueKind.String)
                {
                    var email = emailProp.GetString()?.Trim().ToLowerInvariant();
                    if (!string.IsNullOrWhiteSpace(email))
                    {
                        context.Items["AuthLoginEmail"] = email;
                    }
                }
            }
            catch (JsonException)
            {
                // Ignore malformed payload; model binding/validation will handle request rejection.
            }
        }
    }

    await next();
});

app.UseRateLimiter();

app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/", () => Results.Ok(new
{
    service = "StoryRAG API",
    status = "ok"
}));

app.MapGet("/health", () => Results.Ok(new
{
    status = "healthy"
}));

app.MapControllers();

app.Run();

static string GetAuthLoginPartitionKey(HttpContext context)
{
    var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown-ip";
    var email = context.Items.TryGetValue("AuthLoginEmail", out var value)
        ? value?.ToString()
        : null;

    return $"{ip}:{(string.IsNullOrWhiteSpace(email) ? "unknown-email" : email)}";
}
