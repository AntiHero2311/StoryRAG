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

export interface ChatHistoryItem {
    id: string;
    question: string;
    answer: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    createdAt: string;
}

export interface ChatHistoryResult {
    items: ChatHistoryItem[];
    totalCount: number;
    page: number;
    pageSize: number;
}

export interface RewriteRequest {
    originalText: string;
    instruction?: string;
    chapterId?: string;
}

export interface RewriteResult {
    historyId: string;
    originalText: string;
    rewrittenText: string;
    instruction: string;
    totalTokens: number;
    createdAt: string;
}

export interface RewriteHistoryItem {
    id: string;
    chapterId?: string;
    originalText: string;
    rewrittenText: string;
    instruction: string;
    totalTokens: number;
    createdAt: string;
}

export interface RewriteHistoryResult {
    items: RewriteHistoryItem[];
    totalCount: number;
    page: number;
    pageSize: number;
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

    /** Lấy lịch sử chat của user trong dự án, có phân trang. */
    getChatHistory: async (projectId: string, page = 1, pageSize = 20): Promise<ChatHistoryResult> => {
        const res = await api.get<ChatHistoryResult>(`/ai/${projectId}/chat/history`, {
            params: { page, pageSize },
        });
        return res.data;
    },

    /** Viết lại đoạn văn bằng AI. */
    rewrite: async (projectId: string, request: RewriteRequest): Promise<RewriteResult> => {
        const res = await api.post<RewriteResult>(`/ai/${projectId}/rewrite`, request);
        return res.data;
    },

    /** Lấy lịch sử viết lại trong dự án, tùy chọn lọc theo chapter. */
    getRewriteHistory: async (
        projectId: string,
        page = 1,
        pageSize = 20,
        chapterId?: string,
    ): Promise<RewriteHistoryResult> => {
        const res = await api.get<RewriteHistoryResult>(`/ai/${projectId}/rewrite/history`, {
            params: { page, pageSize, ...(chapterId ? { chapterId } : {}) },
        });
        return res.data;
    },
};
