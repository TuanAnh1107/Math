import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import ThemeSwitcher from './Theme';
import './admin-mobile-nav.css';

export type AdminNavigationItem = { label: string; icon: ReactNode };

type AdminMobileNavProps = {
  items: AdminNavigationItem[];
  page: string;
  onNavigate: (page: string) => void;
  onStudent: () => void;
};

const primaryPages = ['Tổng quan', 'Câu hỏi', 'Học sinh', 'Kết quả'];
const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function NavigationSymbol({ close = false }: { close?: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {close ? <path d="m6 6 12 12M6 18 18 6"/> : <path d="M4 12h15m-6-6 6 6-6 6"/>}
  </svg>;
}

export default function AdminMobileNav({ items, page, onNavigate, onStudent }: AdminMobileNavProps) {
  const [open, setOpen] = useState(false);
  const sheetId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : triggerRef.current;
    const overflow = document.body.style.overflow;
    const siblings = Array.from(dialog.closest('.app')?.children ?? [])
      .filter((element): element is HTMLElement => element instanceof HTMLElement && !element.contains(dialog))
      .map(element => ({ element, inert: element.inert }));
    siblings.forEach(({ element }) => { element.inert = true; });
    document.body.style.overflow = 'hidden';
    dialog.querySelector<HTMLElement>(focusableSelector)?.focus();

    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
        .filter(element => element.getClientRects().length > 0);
      if (!controls.length) { event.preventDefault(); dialog.focus(); return; }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!dialog.contains(document.activeElement) || event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const media = window.matchMedia('(max-width:767px)');
    const resize = () => { if (!media.matches) setOpen(false); };
    document.addEventListener('keydown', keydown);
    media.addEventListener('change', resize);
    return () => {
      document.removeEventListener('keydown', keydown);
      media.removeEventListener('change', resize);
      document.body.style.overflow = overflow;
      siblings.forEach(({ element, inert }) => { element.inert = inert; });
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  const navigate = (label: string) => { setOpen(false); onNavigate(label); };
  const secondaryActive = !primaryPages.includes(page);
  return <>
    <nav className="mobile-nav admin-mobile-nav" aria-label="Điều hướng quản trị">
      {primaryPages.map(label => {
        const item = items.find(entry => entry.label === label);
        return <button type="button" key={label} className={page === label ? 'active' : ''} aria-current={page === label ? 'page' : undefined} onClick={() => navigate(label)}>
          <span className="mobile-nav-icon">{item?.icon}</span><span>{label}</span>
        </button>;
      })}
      <button ref={triggerRef} type="button" className={open || secondaryActive ? 'active' : ''} aria-haspopup="dialog" aria-expanded={open} aria-controls={sheetId} onClick={() => setOpen(true)}>
        <span className="mobile-nav-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></span><span>Thêm</span>
      </button>
    </nav>
    {open && <div className="sheet-backdrop admin-navigation-backdrop" onClick={() => setOpen(false)}>
      <div id={sheetId} ref={dialogRef} className="mobile-sheet admin-navigation-sheet" role="dialog" aria-modal="true" aria-labelledby={`${sheetId}-title`} tabIndex={-1} onClick={event => event.stopPropagation()}>
        <div className="section-head"><h3 id={`${sheetId}-title`}>Không gian quản trị</h3><button type="button" aria-label="Đóng điều hướng quản trị" onClick={() => setOpen(false)}><NavigationSymbol close/></button></div>
        <ThemeSwitcher settings/>
        {items.map(item => <button type="button" className="settings-row" key={item.label} aria-current={page === item.label ? 'page' : undefined} onClick={() => navigate(item.label)}><span>{item.label}</span><NavigationSymbol/></button>)}
        <button type="button" className="settings-row" onClick={() => { setOpen(false); onStudent(); }}><span>Giao diện học sinh</span><NavigationSymbol/></button>
      </div>
    </div>}
  </>;
}
