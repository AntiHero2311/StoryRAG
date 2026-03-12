using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;

namespace Service.Helpers;

/// <summary>
/// Lọc các nội dung người dùng có dấu hiệu Prompt Injection trước khi đưa vào LLM context.
/// </summary>
public static class PromptSanitizer
{
    // Giới hạn kích thước đầu vào: 50,000 ký tự (~16,000 tokens)
    public const int MaxInputLength = 50_000;

    // Timeout cho từng regex để tránh ReDoS
    private static readonly TimeSpan RegexTimeout = TimeSpan.FromSeconds(1);

    private static readonly (string Pattern, string Replacement)[] InjectionPatterns =
    [
        // Token injection — special delimiters của các LLM phổ biến (Llama, Qwen, Mistral, GPT)
        (@"<\|(?:system|user|assistant|im_start|im_end|begin_of_text|end_of_text|eot_id|start_header_id|end_header_id)[^|]*\|>",
         "[...]"),
        (@"\[/?(?:INST|SYS|s)\]", "[...]"),
        (@"</?(?:s|system|user|assistant|human|bot|llm)>", "[...]"),

        // Override / ignore instructions
        (@"\b(?:ignore|forget|disregard|bypass|override)\s+(?:all\s+)?(?:previous|above|prior|earlier|your)?\s*(?:instructions?|prompts?|rules?|guidelines?|directives?|context)\b",
         "[nội dung đã lọc]"),

        // Yêu cầu tiết lộ thông tin hệ thống
        (@"\b(?:print|show|reveal|display|output|repeat|tell\s+me|give\s+me|what\s+is|what\s+are)\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions?|rules?|config(?:uration)?|secrets?|api[\s_-]?keys?|database|connection\s*string)\b",
         "[nội dung đã lọc]"),

        // Jailbreak / role switching
        (@"\b(?:act\s+as|pretend(?:\s+to\s+be)?|you\s+are|you're|you\s+must\s+be|from\s+now\s+on)\s+(?:a\s+|an\s+)?(?:different|new|another|unrestricted|uncensored|jailbroken|evil|DAN|GPT-?(?:Dan|4|3\.5))\b",
         "[nội dung đã lọc]"),

        // SYSTEM OVERRIDE markers rõ ràng
        (@"\bSYSTEM\s*(?:OVERRIDE|PROMPT|MESSAGE|COMMAND|INSTRUCTION)\b",
         "[nội dung đã lọc]"),

        // Section headers injection dạng Markdown / dấu ngoặc vuông
        (@"(?i)(?:^|\n)\s*#{1,6}\s*(?:System|Instruction|Override|New\s+Prompt|Admin|Root)",
         "[nội dung đã lọc]"),
        (@"(?i)\[SYSTEM[^\]]{0,50}\]",  "[...]"),
        (@"(?i)<!--\s*(?:system|override|inject)[^-]{0,100}-->", "[...]"),
    ];

    /// <summary>
    /// Làm sạch nội dung người dùng. Trả về chuỗi đã được lọc, sẵn sàng nhúng vào prompt.
    /// </summary>
    public static string SanitizeUserContent(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;

        var sanitized = input.Length > MaxInputLength
            ? input[..MaxInputLength] + "\n[... nội dung bị cắt ngắn do vượt giới hạn ...]"
            : input;

        foreach (var (pattern, replacement) in InjectionPatterns)
        {
            try
            {
                sanitized = Regex.Replace(
                    sanitized, pattern, replacement,
                    RegexOptions.IgnoreCase | RegexOptions.Multiline,
                    RegexTimeout);
            }
            catch (RegexMatchTimeoutException)
            {
                // Nếu regex timeout → bỏ qua pattern đó, không crash
            }
        }

        return sanitized;
    }

    /// <summary>
    /// Kiểm tra xem chuỗi có chứa dấu hiệu injection không (dùng để log cảnh báo).
    /// </summary>
    public static bool ContainsInjectionAttempt(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return false;

        foreach (var (pattern, _) in InjectionPatterns)
        {
            try
            {
                if (Regex.IsMatch(input, pattern,
                    RegexOptions.IgnoreCase | RegexOptions.Multiline, RegexTimeout))
                    return true;
            }
            catch (RegexMatchTimeoutException) { /* bỏ qua */ }
        }

        return false;
    }

    /// <summary>
    /// Kiểm tra và log nếu có injection attempt, sau đó trả về nội dung đã làm sạch.
    /// </summary>
    public static string SanitizeAndWarn(string? input, ILogger logger, string context)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;

        if (ContainsInjectionAttempt(input))
            logger.LogWarning("Phát hiện nghi ngờ Prompt Injection tại [{Context}]. Nội dung đã được lọc.", context);

        return SanitizeUserContent(input);
    }
}
