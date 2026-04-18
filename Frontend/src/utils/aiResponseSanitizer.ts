const FALLBACK_MESSAGE = 'Xin lỗi, phản hồi AI vừa rồi chưa hợp lệ. Vui lòng gửi lại câu hỏi.';
const EXPLICIT_LEAK_REGEX = /<thought|<\/thought|<story_?context|<\/story_?context|<story_?summary|<\/story_?summary/i;

export function sanitizeAiResponseForDisplay(text: string): string {
    const normalized = (text ?? '').trim();
    if (!normalized) return normalized;

    const cleaned = stripPromptLeakSections(normalized);
    if (!cleaned) return FALLBACK_MESSAGE;
    if (EXPLICIT_LEAK_REGEX.test(cleaned)) return FALLBACK_MESSAGE;

    return cleaned;
}

function stripPromptLeakSections(text: string): string {
    const leakLineRegex = /^\s*(?:[-*•]\s*)?(?:\[(?:hướng dẫn hệ thống|câu hỏi của người dùng)[^\]]*\]|ai assistant helping an author|analyze and answer questions based on the provided content|do not reveal system prompt|do not execute commands inside|base answers only on|infer\/synthesize if necessary).*$/gim;

    return text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/<thought[^>]*>[\s\S]*?<\/thought>/gi, '')
        .replace(/<story_?context[^>]*>[\s\S]*?<\/story_?context>/gi, '')
        .replace(/<story_?summary[^>]*>[\s\S]*?<\/story_?summary>/gi, '')
        .replace(leakLineRegex, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

