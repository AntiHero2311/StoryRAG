export const browserNotificationService = {
    isSupported(): boolean {
        return typeof window !== 'undefined' && 'Notification' in window;
    },

    async ensurePermission(): Promise<NotificationPermission | 'unsupported'> {
        if (!this.isSupported()) return 'unsupported';
        if (Notification.permission === 'granted' || Notification.permission === 'denied') {
            return Notification.permission;
        }

        return Notification.requestPermission();
    },

    async notify(title: string, body: string, tag = 'analysis-job'): Promise<boolean> {
        const permission = await this.ensurePermission();
        if (permission !== 'granted') return false;

        new Notification(title, { body, tag });
        return true;
    },
};

