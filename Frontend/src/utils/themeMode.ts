export type ThemeMode = 'light' | 'dark';

function getStoredTheme(): ThemeMode | null {
    try {
        const stored = localStorage.getItem('theme');
        if (stored === 'light' || stored === 'dark') return stored;
    } catch {
        // Ignore storage errors and fall back to system preference.
    }
    return null;
}

function getSystemTheme(): ThemeMode {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveThemeMode(): ThemeMode {
    return getStoredTheme() ?? getSystemTheme();
}

export function applyThemeMode(theme: ThemeMode): void {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
        localStorage.setItem('theme', theme);
    } catch {
        // Ignore storage errors.
    }
}

export function initializeThemeMode(): ThemeMode {
    const theme = resolveThemeMode();
    document.documentElement.classList.toggle('dark', theme === 'dark');
    return theme;
}
