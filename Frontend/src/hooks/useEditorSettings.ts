import { useState, useEffect, useCallback } from 'react';
import { editorSettingsService, EditorSettings } from '../services/editorSettingsService';

const CACHE_KEY = 'storyrag_editor_settings';

const DEFAULTS: EditorSettings = { editorFont: 'Be Vietnam Pro', editorFontSize: 17 };

// ── Google Fonts to load (Be Vietnam Pro is already in index.html) ────────────
const GOOGLE_FONTS: Record<string, string> = {
    'Merriweather':    'Merriweather:wght@400;700',
    'Lora':            'Lora:wght@400;700',
    'Playfair Display':'Playfair+Display:wght@400;700',
    'Crimson Text':    'Crimson+Text:wght@400;600',
    'Inter':           'Inter:wght@400;600',
    'IBM Plex Mono':   'IBM+Plex+Mono:wght@400;600',
};

function loadGoogleFont(fontName: string) {
    if (!GOOGLE_FONTS[fontName]) return; // system font, already loaded
    const id = `gfont-${fontName.replace(/\s+/g, '-').toLowerCase()}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${GOOGLE_FONTS[fontName]}&display=swap`;
    document.head.appendChild(link);
}

function readCache(): EditorSettings {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { ...DEFAULTS };
}

function writeCache(settings: EditorSettings) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
}

export function useEditorSettings() {
    const [settings, setSettings] = useState<EditorSettings>(readCache);
    const [loading, setLoading] = useState(true);

    // Load from API on mount (to sync cross-device)
    useEffect(() => {
        editorSettingsService.get()
            .then(data => {
                setSettings(data);
                writeCache(data);
                loadGoogleFont(data.editorFont);
            })
            .catch(() => { /* use cached */ })
            .finally(() => setLoading(false));
    }, []);

    // Apply font whenever settings change
    useEffect(() => {
        loadGoogleFont(settings.editorFont);
    }, [settings.editorFont]);

    const setFont = useCallback((fontName: string) => {
        const next = { ...settings, editorFont: fontName };
        setSettings(next);
        writeCache(next);
        loadGoogleFont(fontName);
        editorSettingsService.update({ editorFont: fontName }).catch(() => {});
    }, [settings]);

    const setFontSize = useCallback((size: number) => {
        const next = { ...settings, editorFontSize: size };
        setSettings(next);
        writeCache(next);
        editorSettingsService.update({ editorFontSize: size }).catch(() => {});
    }, [settings]);

    return { settings, loading, setFont, setFontSize };
}

export const AVAILABLE_FONTS = [
    { name: 'Be Vietnam Pro', label: 'Be Vietnam Pro' },
    { name: 'Merriweather',   label: 'Merriweather' },
    { name: 'Lora',           label: 'Lora' },
    { name: 'Playfair Display', label: 'Playfair Display' },
    { name: 'Crimson Text',   label: 'Crimson Text' },
    { name: 'Inter',          label: 'Inter' },
    { name: 'IBM Plex Mono',  label: 'IBM Plex Mono' },
];

export const AVAILABLE_SIZES = [15, 16, 17, 18, 20];
