export type ThemePreference = 'light' | 'dark' | 'system';

export const SETTINGS_STORAGE_KEY = 'ischkul-settings';

const resolveSystemTheme = (): Exclude<ThemePreference, 'system'> => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

let systemMediaQuery: MediaQueryList | null = null;
let systemListener: ((event: MediaQueryListEvent) => void) | null = null;

const detachSystemListener = () => {
  if (systemMediaQuery && systemListener) {
    systemMediaQuery.removeEventListener('change', systemListener);
  }
  systemMediaQuery = null;
  systemListener = null;
};

const attachSystemListener = (onChange: () => void) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  detachSystemListener();
  systemMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  systemListener = () => onChange();
  systemMediaQuery.addEventListener('change', systemListener);
};

export const applyThemePreference = (preference: ThemePreference) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const resolved = preference === 'system' ? resolveSystemTheme() : preference;

  root.dataset.theme = resolved;
  root.dataset.themePreference = preference;

  if (resolved === 'dark') {
    root.classList.add('theme-dark');
    root.classList.remove('theme-light');
  } else {
    root.classList.add('theme-light');
    root.classList.remove('theme-dark');
  }

  if (preference === 'system') {
    attachSystemListener(() => applyThemePreference('system'));
  } else {
    detachSystemListener();
  }
};

export const initTheme = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const preference: ThemePreference = parsed?.theme ?? 'light';
    applyThemePreference(preference);
  } catch {
    applyThemePreference('light');
  }
};
