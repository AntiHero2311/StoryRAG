import { api } from './api';

export interface SubscriptionPlan {
    id: number;
    planName: string;
    price: number;
    maxAnalysisCount: number;
    maxTokenLimit: number;
    description: string | null;
    isActive: boolean;
}

export interface UserSubscription {
    id: number;
    planId: number;
    planName: string;
    price: number;
    maxAnalysisCount: number;
    maxTokenLimit: number;
    startDate: string;
    endDate: string;
    status: string;
    usedAnalysisCount: number;
    usedTokens: number;
}

export interface MySubscriptionResponse {
    message?: string;
    subscription?: UserSubscription | null;
}

export interface CreatePlanRequest {
    planName: string;
    price: number;
    maxAnalysisCount: number;
    maxTokenLimit: number;
    description?: string;
    isActive: boolean;
}

export interface UpdatePlanRequest {
    planName?: string;
    price?: number;
    maxAnalysisCount?: number;
    maxTokenLimit?: number;
    description?: string;
    isActive?: boolean;
}

export const subscriptionService = {
    getPlans: (includeInactive = false) =>
        api.get<SubscriptionPlan[]>(`/subscription/plans${includeInactive ? '?includeInactive=true' : ''}`).then(r => r.data),

    getPlanById: (id: number) =>
        api.get<SubscriptionPlan>(`/subscription/plans/${id}`).then(r => r.data),

    /** Backend returns UserSubscription object if active, or { message, subscription: null } if none. */
    getMySubscription: async (): Promise<UserSubscription | null> => {
        try {
            const r = await api.get('/subscription/my');
            // Has a real subscription when response contains 'id' and 'planId'
            if (r.data?.id && r.data?.planId) return r.data as UserSubscription;
            return null;
        } catch {
            return null;
        }
    },

    createPlan: (data: CreatePlanRequest) =>
        api.post<SubscriptionPlan>('/subscription/plans', data).then(r => r.data),

    updatePlan: (id: number, data: UpdatePlanRequest) =>
        api.put<SubscriptionPlan>(`/subscription/plans/${id}`, data).then(r => r.data),

    deletePlan: (id: number) =>
        api.delete(`/subscription/plans/${id}`).then(r => r.data),

    /** Đăng ký plan cho user hiện tại. Free plan (price=0) sẽ tự động Active. */
    subscribe: (planId: number): Promise<UserSubscription> =>
        api.post<UserSubscription>('/subscription/subscribe', { planId }).then(r => r.data),
};
