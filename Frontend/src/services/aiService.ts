import { api } from './api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ChatRequest {
    question: string;
}

export interface AiChatResult {
    answer: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    contextChunks: string[];
}

// ── Service ────────────────────────────────────────────────────────────────

export const aiService = {
    /** Embed tất cả chunks của current version của một chương. */
    embedChapter: async (chapterId: string): Promise<{ message: string }> => {
        const res = await api.post(`/ai/chapters/${chapterId}/embed`);
        return res.data;
    },

    /** AI Chat — hỏi đáp về nội dung dự án truyện. */
    chat: async (projectId: string, question: string): Promise<AiChatResult> => {
        const res = await api.post<AiChatResult>(`/ai/${projectId}/chat`, { question });
        return res.data;
    },
};
