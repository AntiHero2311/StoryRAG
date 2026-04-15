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
};

