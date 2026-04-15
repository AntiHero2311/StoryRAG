using Microsoft.Extensions.Logging;

namespace Service.Helpers;

/// <summary>
/// Kiểm tra output từ LLM để phát hiện rò rỉ thông tin cấu hình hoặc bí mật hệ thống.
/// </summary>
public static class LlmOutputValidator
{
    private const string SafeFallback = "Xin lỗi, tôi không thể trả lời câu hỏi này.";

    // Các pattern nhạy cảm không được phép xuất hiện trong response trả về user
    private static readonly string[] SensitivePatterns =
    [
        // Database / connection
        "ConnectionStrings", "DefaultConnection", "Host=", "Port=5432",
        "Password=", "User ID=", "Database=", "pooler.supabase.com",
        "DATABASE_URL",

        // Secrets & keys
        "MasterKey", "DataEncryptionKey", "Jwt:Key", "Jwt:Issuer",
        "ApiKey", "api_key", "API_KEY",
        "Gemini:ChatApiKey", "Gemini:AnalyzeApiKey", "Gemini:ChatModels",
        "Security:MasterKey",

        // Email credentials
        "Email:Password", "smtp.gmail.com", "App password",

        // Config files
        "appsettings.json", "appsettings.Development",
        "Program.cs", "launchSettings.json",

        // Auth / token patterns có thể rò rỉ
        "Bearer eyJ",  // JWT token prefix
    ];

    /// <summary>
    /// Kiểm tra response. Nếu chứa thông tin nhạy cảm, trả về safe fallback và log cảnh báo.
    /// </summary>
    public static string ValidateOrReplace(string? response, ILogger? logger = null, string context = "")
    {
        if (string.IsNullOrWhiteSpace(response)) return string.Empty;

        foreach (var pattern in SensitivePatterns)
        {
            if (response.Contains(pattern, StringComparison.OrdinalIgnoreCase))
            {
                logger?.LogWarning(
                    "⚠️ LLM response tại [{Context}] chứa thông tin nhạy cảm (pattern: '{Pattern}'). Đã thay thế.",
                    context, pattern);
                return SafeFallback;
            }
        }

        return response;
    }

    /// <summary>
    /// Phiên bản cho chat: validate và trả về response gốc nếu an toàn.
    /// </summary>
    public static string ValidateChatResponse(string? response, ILogger logger)
        => ValidateOrReplace(response, logger, "AiChat");

    /// <summary>
    /// Phiên bản cho rewrite: validate và trả về response gốc nếu an toàn.
    /// </summary>
    public static string ValidateRewriteResponse(string? response, ILogger logger)
        => ValidateOrReplace(response, logger, "AiRewrite");
}
