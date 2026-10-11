import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';
const ThemeContext = createContext<{ mode: ThemeMode; dark: boolean; setMode: (mode: ThemeMode) => void }>({
  mode: 'system', dark: false, setMode: () => {},
});
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, updateMode] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem('math-mentor-theme');
      return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch { return 'system'; }
  });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const dark = mode === 'dark' || mode === 'system' && systemDark;
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [dark]);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const change = () => setSystemDark(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  const setMode = (next: ThemeMode) => {
    updateMode(next);
    try { localStorage.setItem('math-mentor-theme', next); } catch { /* Preference still works without storage. */ }
  };
  return <ThemeContext.Provider value={{ mode, dark, setMode }}>{children}</ThemeContext.Provider>;
}
export function useTheme() { return useContext(ThemeContext); }
function ThemeIcon({ dark }: { dark: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{dark ? <path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/> : <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></>}</svg>;
}
const options: [ThemeMode, string][] = [['light', 'Sáng'], ['dark', 'Tối'], ['system', 'Theo hệ thống']];
export default function ThemeSwitcher({ settings = false }: { settings?: boolean }) {
  const { mode, dark, setMode } = useTheme();
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (settings) return;
    const close = (event: PointerEvent) => {
      if (!details.current?.contains(event.target as Node)) details.current?.removeAttribute('open');
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && details.current?.open) {
        details.current.removeAttribute('open');
        details.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape);};
  }, [settings]);
  const controls = <div className="theme-options" role="group" aria-label="Giao diện ứng dụng">{options.map(([value, label]) =>
    <button type="button" key={value} aria-pressed={mode === value} className={mode === value ? 'selected' : ''} onClick={() => {
      setMode(value);
      if (!settings) { details.current?.removeAttribute('open'); details.current?.querySelector('summary')?.focus(); }
    }}><ThemeIcon dark={value === 'dark'}/><span>{label}</span>{mode === value && <span className="theme-check" aria-hidden="true">✓</span>}</button>
  )}</div>;
  return settings ? <div className="theme-settings"><div><ThemeIcon dark={dark}/><strong>Giao diện ứng dụng</strong></div><p>Sáng, tối hoặc tự động theo thiết bị.</p>{controls}</div> :
    <details className="theme-switcher" ref={details}><summary aria-label="Chọn giao diện ứng dụng" title="Giao diện ứng dụng"><ThemeIcon dark={dark}/></summary><div className="theme-popover"><span>GIAO DIỆN ỨNG DỤNG</span>{controls}</div></details>;
}
