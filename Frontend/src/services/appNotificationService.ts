export type AppNotificationType = 'success' | 'error' | 'info' | 'warning';

export interface AppNotificationItem {
    id: string;
    type: AppNotificationType;
    title: string;
    message: string;
    createdAt: string;
    isRead: boolean;
    tag?: string;
}

type NewAppNotification = Omit<AppNotificationItem, 'id' | 'createdAt' | 'isRead'>;

const STORAGE_KEY = 'storyrag:notifications';
const UPDATED_EVENT = 'storyrag:notifications-updated';
const MAX_ITEMS = 50;

const canUseWindow = () => typeof window !== 'undefined';

const parseStored = (): AppNotificationItem[] => {
    if (!canUseWindow()) return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as AppNotificationItem[];
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(item =>
            typeof item?.id === 'string' &&
            typeof item?.title === 'string' &&
            typeof item?.message === 'string' &&
            typeof item?.createdAt === 'string');
    } catch {
        return [];
    }
};

const persist = (items: AppNotificationItem[]) => {
    if (!canUseWindow()) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
    window.dispatchEvent(new CustomEvent(UPDATED_EVENT));
};

export const appNotificationService = {
    getAll(): AppNotificationItem[] {
        return parseStored()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    add(notification: NewAppNotification): AppNotificationItem {
        const current = parseStored();
        const nextItem: AppNotificationItem = {
            id: canUseWindow() && typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : Math.random().toString(36).slice(2),
            type: notification.type,
            title: notification.title,
            message: notification.message,
            createdAt: new Date().toISOString(),
            isRead: false,
            tag: notification.tag,
        };

        const next = notification.tag
            ? [nextItem, ...current.filter(item => item.tag !== notification.tag)]
            : [nextItem, ...current];

        persist(next);
        return nextItem;
    },

    markAllRead(): void {
        const current = parseStored();
        if (current.length === 0) return;
        const next = current.map(item => item.isRead ? item : { ...item, isRead: true });
        persist(next);
    },

    subscribe(listener: () => void): () => void {
        if (!canUseWindow()) return () => { };
        window.addEventListener(UPDATED_EVENT, listener);
        return () => window.removeEventListener(UPDATED_EVENT, listener);
    },
};

