import { api } from './api';

export interface EditorSettings {
    editorFont: string;
    editorFontSize: number;
}

export const editorSettingsService = {
    get: () =>
        api.get<EditorSettings>('/settings').then(r => r.data),

    update: (data: Partial<EditorSettings>) =>
        api.put<EditorSettings>('/settings', data).then(r => r.data),
};
