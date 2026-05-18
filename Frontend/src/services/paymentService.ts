import { api } from './api';

export interface CreateVnPayPaymentUrlResponse {
    paymentId: string;
    txnRef: string;
    checkoutUrl: string;
    amount: number;
    description: string;
}

export interface VnPayOrderStatusResponse {
    txnRef: string;
    status: string;
}

export interface VnPayIpnAcknowledgeResponse {
    rspCode: string;
    message: string;
}

export interface PaymentResponse {
    id: string;
    userId: string;
    subscriptionId?: number | null;
    planId: number;
    planName?: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    status: 'Pending' | 'Completed' | 'Failed' | 'Refunded' | 'Cancelled';
    transactionId?: string;
    description?: string;
    paidAt?: string;
    refundedAt?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface PaymentHistoryResponse {
    payments: PaymentResponse[];
    totalCount: number;
    totalSpent: number;
    statusSummary: Record<string, number>;
}

interface ApiResponse<T> {
    success: boolean;
    data: T;
    error?: string;
}

export const paymentService = {
    async createVnPayPaymentUrl(planId: number): Promise<CreateVnPayPaymentUrlResponse> {
        const response = await api.post<ApiResponse<CreateVnPayPaymentUrlResponse>>('/payment/vnpay/create-url', { planId });
        return response.data.data;
    },

    async getVnPayOrderStatus(txnRef: string): Promise<VnPayOrderStatusResponse> {
        const response = await api.get<ApiResponse<VnPayOrderStatusResponse>>(`/payment/vnpay/order/${encodeURIComponent(txnRef)}`);
        return response.data.data;
    },

    async processVnPayReturnQuery(rawQueryString: string): Promise<VnPayIpnAcknowledgeResponse> {
        const normalizedQuery = rawQueryString.startsWith('?')
            ? rawQueryString.slice(1)
            : rawQueryString;
        const response = await api.get<{ rspCode?: string; message?: string; RspCode?: string; Message?: string }>(`/payment/vnpay/ipn?${normalizedQuery}`);
        return {
            rspCode: response.data.rspCode ?? response.data.RspCode ?? '',
            message: response.data.message ?? response.data.Message ?? '',
        };
    },

    async getPaymentHistory(page = 1, pageSize = 20): Promise<PaymentHistoryResponse> {
        const response = await api.get<ApiResponse<PaymentHistoryResponse>>('/payment/history', {
            params: { page, pageSize }
        });
        return response.data.data;
    },
};
