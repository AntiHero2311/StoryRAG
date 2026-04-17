import { api } from './api';

export interface CreatePayOsPaymentLinkResponse {
    paymentId: string;
    orderCode: number;
    checkoutUrl: string;
    qrCode?: string | null;
    amount: number;
    description: string;
}

export interface PayOsOrderStatusResponse {
    orderCode: number;
    status: string;
}

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

interface ApiResponse<T> {
    success: boolean;
    data: T;
    error?: string;
}

export const paymentService = {
    async createPayOsPaymentLink(planId: number): Promise<CreatePayOsPaymentLinkResponse> {
        const response = await api.post<ApiResponse<CreatePayOsPaymentLinkResponse>>('/payment/payos/create-link', { planId });
        return response.data.data;
    },

    async getPayOsOrderStatus(orderCode: number): Promise<PayOsOrderStatusResponse> {
        const response = await api.get<ApiResponse<PayOsOrderStatusResponse>>(`/payment/payos/order/${orderCode}`);
        return response.data.data;
    },

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
};

