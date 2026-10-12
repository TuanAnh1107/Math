import { useEffect, useRef, type RefObject } from 'react';

// Pseudo-elements move within existing nav/tabs. No second router or delayed navigation.
export default function useNavigationMotion(root: RefObject<HTMLDivElement | null>, routeKey: string, enabled: boolean) {
  const measureRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const app = root.current;
    if (!app || !enabled) return;
    let frame = 0;
    const decorated = new Set<HTMLElement>();
    const measure = () => {
      frame = 0;
      const nav = app.querySelector<HTMLElement>('.sidebar nav');
      const active = nav?.querySelector<HTMLElement>('.nav-item.active');
      if (nav && active) {
        nav.classList.add('signature-navigation'); decorated.add(nav);
        nav.style.setProperty('--nav-y', `${active.offsetTop}px`);
        nav.style.setProperty('--nav-height', `${active.offsetHeight}px`);
      } else if (nav) {
        nav.classList.remove('signature-navigation');
        nav.style.removeProperty('--nav-y');
        nav.style.removeProperty('--nav-height');
      }
      const tabs = Array.from(app.querySelectorAll<HTMLElement>('main .tabs')).filter(tab => !tab.closest('[hidden]'));
      for (const tab of tabs) {
        const selected = tab.querySelector<HTMLElement>('button.selected');
        if (!selected) { tab.classList.remove('signature-tabs'); continue; }
        tab.classList.add('signature-tabs'); decorated.add(tab);
        tab.style.setProperty('--tab-x', `${selected.offsetLeft}px`);
        tab.style.setProperty('--tab-y', `${selected.offsetTop}px`);
        tab.style.setProperty('--tab-width', `${selected.offsetWidth}px`);
        tab.style.setProperty('--tab-height', `${selected.offsetHeight}px`);
      }
      app.querySelectorAll<HTMLButtonElement>('.sidebar .nav-item').forEach(button => {
        const label = button.querySelector('span')?.textContent?.trim();
        if (label && !button.title) button.title = label;
      });
    };
    const schedule = () => { if (!frame && !document.hidden) frame = requestAnimationFrame(measure); };
    measureRef.current = schedule;
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    const nav = app.querySelector<HTMLElement>('.sidebar nav');
    if (nav) observer?.observe(nav);
    const main = app.querySelector('main');
    if (main) observer?.observe(main);
    window.addEventListener('resize', schedule, { passive: true });
    const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else schedule(); };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(frame); observer?.disconnect(); measureRef.current = null;
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', visibility);
      decorated.forEach(element => {
        element.classList.remove('signature-navigation', 'signature-tabs');
        ['--nav-y','--nav-height','--tab-x','--tab-y','--tab-width','--tab-height'].forEach(property => element.style.removeProperty(property));
      });
    };
  }, [enabled, root]);
  useEffect(() => { measureRef.current?.(); }, [routeKey]);
}
