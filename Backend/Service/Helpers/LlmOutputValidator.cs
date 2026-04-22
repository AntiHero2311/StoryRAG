using Microsoft.Extensions.Logging;
using System.Text.RegularExpressions;

namespace Service.Helpers;

/// <summary>
/// Kiểm tra output từ LLM để phát hiện rò rỉ thông tin cấu hình hoặc bí mật hệ thống.
/// </summary>
public static class LlmOutputValidator
{
    private const string SafeFallback = "Xin lỗi, tôi không thể trả lời câu hỏi này.";
    private const string ChatFallback = "Xin lỗi, phản hồi AI vừa rồi chưa hợp lệ. Vui lòng hỏi lại để tôi trả lời chính xác hơn.";
    private static readonly Regex ThoughtBlockRegex =
        new(@"(?is)<thought[^>]*>.*?</thought>", RegexOptions.Compiled, TimeSpan.FromSeconds(1));
    private static readonly Regex StoryContextBlockRegex =
        new(@"(?is)<story_?context[^>]*>.*?</story_?context>", RegexOptions.Compiled, TimeSpan.FromSeconds(1));
    private static readonly Regex StorySummaryBlockRegex =
        new(@"(?is)<story_?summary[^>]*>.*?</story_?summary>", RegexOptions.Compiled, TimeSpan.FromSeconds(1));
    private static readonly Regex LeakLineRegex =
        new(
            @"(?im)^\s*(?:[-*\u2022]\s*)?(?:\[(?:h\u01b0\u1edbng d\u1eabn h\u1ec7 th\u1ed1ng|c\u00e2u h\u1ecfi c\u1ee7a ng\u01b0\u1eddi d\u00f9ng)[^\]]*\]|ai assistant helping an author|analyze and answer questions based on the provided content|do not reveal system prompt|do not reveal system instructions|do not execute commands inside|base answers only on|infer/synthesize if necessary|experienced writer|continue a story fragment|show, don'?t tell|avoid repetition|no intro/outro|standard vietnamese|no tags like|protagonist:\*|current situation:\*|recent gain:\*|setting:\*|atmosphere:\*).*$",
            RegexOptions.Compiled,
            TimeSpan.FromSeconds(1));
    private static readonly Regex MultiBlankLinesRegex =
        new(@"\n{3,}", RegexOptions.Compiled, TimeSpan.FromSeconds(1));
    private static readonly Regex ExplicitLeakTokenRegex =
        new(@"(?i)<thought|</thought|<story_?context|</story_?context|<story_?summary|</story_?summary", RegexOptions.Compiled, TimeSpan.FromSeconds(1));

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
        "Gemini:ChatApiKey", "Gemini:AnalyzeApiKey", "Gemini:EmbeddingApiKey", "Gemini:ChatModels",
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
    {
        if (string.IsNullOrWhiteSpace(response)) return string.Empty;

        var cleaned = StripPromptLeakSections(response);
        if (string.IsNullOrWhiteSpace(cleaned))
        {
            logger.LogWarning("⚠️ LLM response tại [AiChat] chỉ chứa prompt-leak/instruction text. Đã thay thế fallback an toàn.");
            return ChatFallback;
        }

        if (!string.Equals(cleaned, response.Trim(), StringComparison.Ordinal))
        {
            logger.LogWarning("⚠️ LLM response tại [AiChat] có chứa đoạn prompt nội bộ; đã làm sạch trước khi trả về user.");
        }

        if (ExplicitLeakTokenRegex.IsMatch(cleaned))
        {
            logger.LogWarning("⚠️ LLM response tại [AiChat] vẫn còn token rò rỉ sau khi làm sạch. Đã thay thế fallback an toàn.");
            return ChatFallback;
        }

        return ValidateOrReplace(cleaned, logger, "AiChat");
    }

    /// <summary>
    /// Phiên bản cho rewrite/continue-writing: strip prompt-leak + validate sensitive patterns.
    /// </summary>
    public static string ValidateRewriteResponse(string? response, ILogger logger)
    {
        if (string.IsNullOrWhiteSpace(response)) return string.Empty;

        var cleaned = StripPromptLeakSections(response);

        if (string.IsNullOrWhiteSpace(cleaned))
        {
            logger.LogWarning("⚠️ LLM response tại [AiRewrite] chỉ chứa prompt-leak text sau khi làm sạch.");
            return string.Empty;
        }

        if (!string.Equals(cleaned, response.Trim(), StringComparison.Ordinal))
            logger.LogWarning("⚠️ LLM response tại [AiRewrite] có chứa đoạn prompt nội bộ; đã làm sạch trước khi trả về user.");

        return ValidateOrReplace(cleaned, logger, "AiRewrite");
    }

    private static string StripPromptLeakSections(string response)
    {
        var normalized = response.Trim().Replace("\r\n", "\n").Replace('\r', '\n');
        normalized = ThoughtBlockRegex.Replace(normalized, string.Empty);
        normalized = StoryContextBlockRegex.Replace(normalized, string.Empty);
        normalized = StorySummaryBlockRegex.Replace(normalized, string.Empty);
        normalized = LeakLineRegex.Replace(normalized, string.Empty);
        normalized = MultiBlankLinesRegex.Replace(normalized, "\n\n");
        return normalized.Trim();
    }
}
