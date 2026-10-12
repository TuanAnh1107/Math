import ExamRoom, { getDemoExamConfig, getSavedExamResult, type ExamConfig, type ExamResult } from './ExamRoom';
import ThemeSwitcher, { useTheme } from './Theme';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { curriculumChapters, getAdminTableData } from './sampleData';
import AdminMobileNav from './AdminMobileNav';
import { practiceQuestions, recordPracticeResponse, summarizePractice, type PracticeResponses } from './practiceSession';
import type { TutorMode } from '../shared/ai';
import type { ExternalTutorRequest } from './ai/AiTutor';
import { motionTokens, motionVariables, settlePointer } from './motionTokens';
import LivingMathVisual from './LivingMathVisual';
import AIOrb from './AIOrb';
import useNavigationMotion from './useNavigationMotion';
import useFormDrafts from './useFormDrafts';
const AiTutor = lazy(() => import('./ai/AiTutor'));

type IconName = 'home' | 'book' | 'practice' | 'test' | 'room' | 'ai' | 'tools' | 'chart' | 'route' | 'errors' | 'award' | 'bell' | 'user' | 'arrow' | 'check' | 'fire' | 'star' | 'target' | 'search' | 'plus' | 'close' | 'upload';
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/></>,
    book: <><path d="M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Z"/><path d="M12 5v15"/></>,
    practice: <><path d="m15 4 5 5-11 11H4v-5Z"/><path d="m12 7 5 5"/></>,
    test: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v4H9zM9 12h6M9 16h4"/></>,
    room: <><path d="M4 21V4h13v17M2 21h20M8 8h5M8 12h5M9 21v-5h4v5"/></>,
    ai: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4M18 4h4"/></>,
    tools: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h1m6 0h1M8 16h1m6 0h1"/></>,
    chart: <><path d="M4 3v17h17M8 15v-4m5 4V7m5 8V4"/></>,
    route: <><circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="M8 5h7a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h7"/></>,
    errors: <><path d="M5 3h14v18H5zM9 3v18M13 8h3M13 12h3M13 16h2"/></>,
    award: <><circle cx="12" cy="9" r="6"/><path d="m8 14-2 7 6-3 6 3-2-7"/><path d="m12 6 1 2 2 .3-1.5 1.5.3 2.2-1.8-1-1.8 1 .3-2.2L9 8.3l2-.3Z"/></>,
    bell: <><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5ZM10 21h4"/></>,
    user: <><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
    arrow: <path d="M4 12h15m-6-6 6 6-6 6"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    fire: <path d="M13 2c2 6-3 7-1 11 2-1 3-3 3-5 5 5 6 13-3 13-8 0-9-8-4-13 0 3 1 4 2 4-2-5 3-7 3-10Z"/>,
    star: <path d="m12 3 3 6 6 1-4.5 4.5 1 6.5-5.5-3-5.5 3 1-6.5L3 10l6-1Z"/>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
    search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
const studentNav: { label: string; items: [string, IconName][] }[] = [
  { label: 'TỔNG QUAN', items: [['Trang chủ', 'home']] },
  { label: 'HỌC TẬP', items: [['Chương trình học', 'book'], ['Luyện tập', 'practice'], ['Kiểm tra', 'test'], ['Phòng thi', 'room']] },
  { label: 'HỖ TRỢ', items: [['Trợ lý AI', 'ai'], ['Công cụ Toán', 'tools']] },
  { label: 'TIẾN BỘ', items: [['Tiến độ', 'chart'], ['Lộ trình', 'route'], ['Sổ lỗi sai', 'errors'], ['Thành tích', 'award']] },
  { label: 'TÀI KHOẢN', items: [['Thông báo', 'bell'], ['Hồ sơ', 'user']] },
];
const adminNav: [string, IconName][] = [['Tổng quan', 'home'], ['Chương trình', 'book'], ['Bài học', 'book'], ['Câu hỏi', 'practice'], ['Đề kiểm tra', 'test'], ['Phòng thi', 'room'], ['Học sinh', 'user'], ['Nhóm học sinh', 'user'], ['Kết quả', 'chart'], ['Thông báo', 'bell'], ['Cài đặt', 'tools']];
const dialogFocusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
function Button({ children, onClick, secondary = false, disabled = false }: { children: React.ReactNode; onClick?: () => void; secondary?: boolean; disabled?: boolean }) { return <button disabled={disabled} className={`button ${secondary ? 'secondary' : ''}`} onClick={onClick}>{children}</button>; }
function Progress({ value }: { value: number }) { return <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><div className="progress-fill" style={{ width: `${value}%` }}/></div>; }
function AnimatedCount({ value, reducedMotion = false }: { value: string; reducedMotion?: boolean }) {
  const countRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = countRef.current;
    const match = value.match(/^([\d.]+)(.*)$/);
    if (!element || !match || !('IntersectionObserver' in window) || reducedMotion) return;
    const target = Number(match[1].replace(/\./g, ''));
    if (!Number.isFinite(target) || target <= 0) return;
    let frame = 0;
    let startedAt = 0;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      const tick = (time: number) => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          element.textContent = value;
          return;
        }
        if (!startedAt) startedAt = time;
        const progress = Math.min(1, (time - startedAt) / 650);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = `${new Intl.NumberFormat('vi-VN').format(Math.round(target * eased))}${match[2]}`;
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.35 });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      element.textContent = value;
    };
  }, [reducedMotion, value]);
  return <strong ref={countRef}>{value}</strong>;
}
function Heading({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) { return <div className="page-heading"><div><h1>{title}</h1><p>{sub}</p></div>{children}</div>; }
function Chart({ large = false }: { large?: boolean }) {
  return <div className={`chart ${large ? 'large' : ''}`}><div className="chart-scale"><span>40</span><span>30</span><span>20</span><span>10</span><span>0</span></div><div className="chart-bars">{[42, 66, 52, 83, 70, 35, 18].map((v, i) => <div className={`bar-column ${i > 4 ? 'future' : ''}`} key={i}><div className="bar-track"><div className="bar" style={{ height: `${v}%` }}><span>{Math.round(v / 2)}</span></div></div><span>{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][i]}</span></div>)}</div></div>;
}
export default function App() {
  const { dark } = useTheme();
  const appRef = useRef<HTMLDivElement>(null);
  const tutorVisited = useRef(false);
  const [page, setPage] = useState('Trang chủ');
  const [admin, setAdmin] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const previousRoute = useRef({ page, admin });
  const [more, setMore] = useState(false);
  const [toast, setToast] = useState('');
  const [answer, setAnswer] = useState<number | null>(null);
  const [feedback, setFeedback] = useState(false);
  const [question, setQuestion] = useState(1);
  const [modal, setModal] = useState('');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [externalRequest, setExternalRequest] = useState<ExternalTutorRequest | null>(null);
  const [toolExpression, setToolExpression] = useState('');
  const [secondToolExpression, setSecondToolExpression] = useState('');
  const [filter, setFilter] = useState('Tất cả');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [practiceResponses, setPracticeResponses] = useState<PracticeResponses>({});
  const [practiceActive, setPracticeActive] = useState(false);
  const practiceSummary = summarizePractice(practiceResponses);
  useNavigationMotion(appRef, `${admin}:${page}:${filter}`, page !== 'Làm bài kiểm tra');
  useFormDrafts(appRef, `${admin}:${page}`, modal);
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    const sync = () => { app.dataset.motionPaused = String(document.hidden); };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    const dialog = modal
      ? app.querySelector<HTMLElement>('.modal-backdrop .modal')
      : more ? app.querySelector<HTMLElement>('.sheet-backdrop > .mobile-sheet') : null;
    if (!dialog) return;
    if (more && !modal) {
      const heading = dialog.querySelector('h3');
      if (heading) {
        heading.id = 'student-more-title';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', heading.id);
        dialog.tabIndex = -1;
      }
    }
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    const siblings = Array.from(app.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && !element.contains(dialog))
      .map(element => ({ element, inert: element.inert }));
    siblings.forEach(({ element }) => { element.inert = true; });
    document.body.style.overflow = 'hidden';
    dialog.querySelector<HTMLElement>(dialogFocusableSelector)?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (modal) setModal('');
        else setMore(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(dialogFocusableSelector))
        .filter(element => element.getClientRects().length > 0);
      if (!controls.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
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
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      document.body.style.overflow = overflow;
      siblings.forEach(({ element, inert }) => { element.inert = inert; });
      if (previous?.isConnected) previous.focus();
    };
  }, [modal, more]);

  useEffect(() => {
    const main = appRef.current?.querySelector<HTMLElement>('main');
    const changed = previousRoute.current.page !== page || previousRoute.current.admin !== admin;
    previousRoute.current = { page, admin };
    if (!main || !changed || page === 'Làm bài kiểm tra' || reducedMotion || document.hidden || typeof main.animate !== 'function') return;
    const animations = [main.animate(
      [{ opacity: 0.9 }, { opacity: 1 }],
      { duration: motionTokens.duration.scene, easing: motionTokens.easing.cinematic },
    )];
    main.querySelectorAll<HTMLElement>(':scope > .page-heading, :scope > .focus-header, :scope > .tutor-route > .page-heading').forEach(heading => {
      animations.push(heading.animate(
        [{ opacity: .72, transform: 'translateY(12px)', clipPath: 'inset(0 0 12% 0)' }, { opacity: 1, transform: 'translateY(0)', clipPath: 'inset(0)' }],
        { duration: motionTokens.duration.scene, easing: motionTokens.easing.cinematic },
      ));
    });
    main.querySelectorAll<HTMLElement>(':scope > .toolbar, :scope > .tabs, :scope > .breadcrumb').forEach((element, index) => {
      animations.push(element.animate([{ opacity: .8, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: motionTokens.duration.detail, delay: 55 + index * 35, easing: motionTokens.easing.settle }));
    });
    return () => animations.forEach(animation => animation.cancel());
  }, [admin, page, reducedMotion]);
  useEffect(() => {
    const app = appRef.current;
    const main = app?.querySelector<HTMLElement>('main');
    if (!app || !main || page === 'Làm bài kiểm tra' || !('IntersectionObserver' in window) || reducedMotion) return;
    const revealTargets = Array.from(main.querySelectorAll<HTMLElement>(
      '.card:not(.table-card):not(.tutor):not(.notifications):not(.tool-panel):not(.question-card):not(.completion):not(.profile-main), .stat-card, .continue-card:not(.practice-hero)',
    )).filter(element => !element.hasAttribute('data-motion-reveal'));
    if (!revealTargets.length) return;
    let observer: IntersectionObserver | null = null;
    let initialized = false;
    const revealFrames = new Set<number>();
    const fallbackTimer = window.setTimeout(() => {
      if (initialized) return;
      observer?.disconnect();
      revealTargets.forEach(element => {
        element.removeAttribute('data-motion-reveal');
        element.style.removeProperty('--motion-stagger');
      });
    }, 700);
    try {
      const currentObserver = new IntersectionObserver(entries => {
        if (!initialized && entries.length) {
          initialized = true;
          revealTargets.forEach((element, index) => {
            element.style.setProperty('--motion-stagger', `${Math.min(index, 7) * 55}ms`);
            element.setAttribute('data-motion-reveal', 'pending');
          });
        }
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const target = entry.target as HTMLElement;
          const frame = requestAnimationFrame(() => {
            revealFrames.delete(frame);
            target.setAttribute('data-motion-reveal', 'visible');
          });
          revealFrames.add(frame);
          currentObserver.unobserve(entry.target);
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
      observer = currentObserver;
      revealTargets.forEach(element => {
        currentObserver.observe(element);
      });
    } catch {
      revealTargets.forEach(element => {
        element.removeAttribute('data-motion-reveal');
        element.style.removeProperty('--motion-stagger');
      });
      return;
    }
    return () => {
      observer?.disconnect();
      window.clearTimeout(fallbackTimer);
      revealFrames.forEach(cancelAnimationFrame);
      revealTargets.forEach(element => {
        if (element.getAttribute('data-motion-reveal') === 'pending') element.removeAttribute('data-motion-reveal');
        element.style.removeProperty('--motion-stagger');
      });
    };
  }, [admin, page, reducedMotion]);
  useEffect(() => {
    const app = appRef.current;
    if (!app || admin || page !== 'Trang chủ' || reducedMotion ||
      !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const cards = Array.from(app.querySelectorAll<HTMLElement>('.dashboard-grid .signature-hero, .dashboard-grid .weekly, .dashboard-grid .weak-card, .dashboard-grid .ai-card'));
    const cleanups = cards.map(card => {
      let frame = 0, previousTime = 0;
      let x = .5, y = .5, targetX = .5, targetY = .5;
      let bounds: DOMRect | null = null;
      const decorativeVisual = card.querySelector<HTMLElement>('.living-math-visual');
      let decorativeBounds: DOMRect | null = null;
      let pendingPointer: { x: number; y: number } | null = null;
      const update = (time: number) => {
        frame = 0;
        if (document.hidden) return;
        if (pendingPointer) {
          bounds ??= card.getBoundingClientRect();
          if (decorativeVisual) decorativeBounds ??= decorativeVisual.getBoundingClientRect();
          const overDecoration = decorativeBounds && pendingPointer.x >= decorativeBounds.left && pendingPointer.x <= decorativeBounds.right && pendingPointer.y >= decorativeBounds.top && pendingPointer.y <= decorativeBounds.bottom;
          card.dataset.lightActive = String(!overDecoration);
          if (overDecoration) {
            targetX = targetY = .5;
          } else if (bounds.width && bounds.height) {
            targetX = Math.max(0, Math.min(1, (pendingPointer.x - bounds.left) / bounds.width));
            targetY = Math.max(0, Math.min(1, (pendingPointer.y - bounds.top) / bounds.height));
          }
          pendingPointer = null;
        }
        const elapsed = previousTime ? time - previousTime : 16;
        previousTime = time;
        x = settlePointer(x, targetX, elapsed); y = settlePointer(y, targetY, elapsed);
        const flat = card.classList.contains('signature-hero');
        card.style.setProperty('--spotlight-x', `${x * 100}%`);
        card.style.setProperty('--spotlight-y', `${y * 100}%`);
        card.style.setProperty('--tilt-x', `${flat ? 0 : (0.5 - y) * motionTokens.depth.tiltX * 2}deg`);
        card.style.setProperty('--tilt-y', `${flat ? 0 : (x - 0.5) * motionTokens.depth.tiltY * 2}deg`);
        card.style.setProperty('--layer-x', `${(x - .5) * 8}px`);
        card.style.setProperty('--layer-y', `${(y - .5) * 6}px`);
        if (Math.abs(x - targetX) + Math.abs(y - targetY) > motionTokens.spring.settleThreshold) frame = requestAnimationFrame(update);
        else previousTime = 0;
      };
      const move = (event: PointerEvent) => {
        if (event.pointerType === 'touch' || document.hidden) return;
        pendingPointer = { x: event.clientX, y: event.clientY };
        if (!frame) frame = requestAnimationFrame(update);
      };
      const reset = () => {
        pendingPointer = null; targetX = .5; targetY = .5;
        card.dataset.lightActive = 'false';
        if (!frame && !document.hidden) frame = requestAnimationFrame(update);
      };
      const suspend = () => {
        cancelAnimationFrame(frame); frame = 0; previousTime = 0;
        pendingPointer = null; x = y = targetX = targetY = .5;
        card.dataset.lightActive = 'false';
        ['--tilt-x','--tilt-y'].forEach(property => card.style.setProperty(property, '0deg'));
        ['--layer-x','--layer-y'].forEach(property => card.style.setProperty(property, '0px'));
      };
      const visibility = () => { if (document.hidden) suspend(); };
      const invalidateBounds = () => { bounds = null; decorativeBounds = null; };
      const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(invalidateBounds);
      observer?.observe(card);
      const inView = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
        for (const entry of entries) {
          card.dataset.livingVisible = String(entry.isIntersecting);
          if (!entry.isIntersecting) suspend();
        }
      });
      inView?.observe(card);
      card.classList.add('motion-tilt-card', 'signature-light-card');
      card.addEventListener('pointermove', move);
      card.addEventListener('pointerleave', reset);
      window.addEventListener('scroll', invalidateBounds, { passive: true, capture: true });
      document.addEventListener('visibilitychange', visibility);
      return () => {
        if (frame) cancelAnimationFrame(frame);
        observer?.disconnect(); inView?.disconnect();
        card.removeEventListener('pointermove', move);
        card.removeEventListener('pointerleave', reset);
        window.removeEventListener('scroll', invalidateBounds, true);
        document.removeEventListener('visibilitychange', visibility);
        card.classList.remove('motion-tilt-card', 'signature-light-card');
        delete card.dataset.lightActive; delete card.dataset.livingVisible;
        ['--spotlight-x','--spotlight-y','--tilt-x','--tilt-y','--layer-x','--layer-y'].forEach(property => card.style.removeProperty(property));
      };
    });
    return () => cleanups.forEach(cleanup => cleanup());
  }, [admin, page, reducedMotion]);
  const go = (p: string) => { setPage(p); setMore(false); setFilter('Tất cả'); setSearch(''); window.scrollTo(0, 0); };
  const notify = (text: string) => { setToast(text); setTimeout(() => setToast(''), 4000); };
  const startPractice = () => { setQuestion(1); setAnswer(null); setFeedback(false); setPracticeResponses({}); setPracticeActive(true); go('Câu luyện tập'); };
  const send = (text: string, mode: TutorMode = 'tutor') => setExternalRequest(previous => ({ id: (previous?.id ?? 0) + 1, text, mode }));
  const [examConfig, setExamConfig] = useState<ExamConfig>(() => getDemoExamConfig(1, false));
  const [examResult, setExamResult] = useState<ExamResult | null>(null);
  const viewExamResult = (config: ExamConfig) => { setExamConfig(config); setExamResult(getSavedExamResult(config)); go('Kết quả bài kiểm tra'); };
  const viewHistoryResult = (chapter: number) => viewExamResult({ id: `quiz-chapter-${chapter}-15m`, title: `Kiểm tra 15 phút · Chương ${chapter}`, count: 10, minutes: 15, room: false });
  const finishExam = (result: ExamResult) => { setExamResult(result); go('Kết quả bài kiểm tra'); notify(result.reason === 'expired' ? 'Hết giờ: phiên thi đã đóng. Kết quả demo được tính cục bộ.' : 'Đã đóng phiên thi. Kết quả demo được tính cục bộ, chưa gửi đến giáo viên.'); };
  const isTest = page === 'Làm bài kiểm tra';
  const focus = page === 'Câu luyện tập' || isTest;
  const titles: Record<string, string> = { 'Bài học chi tiết': 'Chương trình học', 'Câu luyện tập': 'Luyện tập', 'Hoàn thành': 'Luyện tập', 'Làm bài kiểm tra': 'Kiểm tra', 'Kết quả bài kiểm tra': 'Kiểm tra' };
  const active = titles[page] || page;
  const dashboard = () => <>
    <Heading title="Chào buổi sáng, Minh" sub="Hôm nay mình tiếp tục chinh phục Toán 9 nhé."><div className="date-label"><span className="live-dot"/>Thứ Hai, 12 tháng 10</div></Heading>
    <div className="dashboard-grid">
      <div className="main-column">
        <section className="continue-card signature-hero"><div className="signature-aurora" aria-hidden="true"><i/><i/><span/></div><div className="continue-content"><div className="eyebrow"><span className="live-dot"/>TIẾP TỤC HỌC</div><h2>Hàm số bậc nhất</h2><p>Chương 2 · Bài 3</p><div className="lesson-subtitle">Đồ thị hàm số y = ax + b</div><div className="continue-progress"><Progress value={72}/><strong>72%</strong></div><Button onClick={() => go('Bài học chi tiết')}>Tiếp tục học <Icon name="arrow" size={17}/></Button></div><LivingMathVisual/></section>
        <div className="stats-grid">{([['fire', '12 ngày', 'Chuỗi học', 'orange'], ['star', '1.850', 'Tổng XP', 'purple'], ['target', '78%', 'Tỷ lệ đúng', 'green'], ['award', 'Cấp 8', 'Nhà chinh phục', 'blue']] as [IconName, string, string, string][]).map(([icon, value, label, color]) => <div className="stat-card" key={label}><span className={`icon-box ${color}`}><Icon name={icon}/></span><AnimatedCount value={value} reducedMotion={reducedMotion}/><span>{label}</span></div>)}</div>
        <section className="card weekly"><div className="section-head"><h3>Tiến độ tuần này</h3><span className="subtle-tag">12 – 18/10</span></div><div className="chart-summary"><strong>126 <span>câu đã làm</span></strong><span className="growth">↗ 18% <span>so với tuần trước</span></span></div><Chart/><div className="chart-legend"><span><i className="legend-dot"/>Số câu đã làm</span><span>Độ chính xác <strong>78%</strong></span></div></section>
        <section className="card activity"><div className="section-head"><h3>Hoạt động gần đây</h3><button className="text-button" onClick={() => go('Tiến độ')}>Xem tất cả <Icon name="arrow" size={15}/></button></div>{([['check', 'Hoàn thành Bài 2 · Hàm số', 'Hôm nay, 08:15', '+30 XP', 'green'], ['test', 'Kiểm tra 15 phút · Chương 2', 'Hôm qua, 19:30', '8.5 điểm', 'blue'], ['award', 'Nhận huy hiệu 7 ngày liên tiếp', '10/10, 20:05', 'Huy hiệu mới', 'orange']] as [IconName,string,string,string,string][]).map(([icon,title,time,reward,color]) => <div className="activity-row" key={title}><span className={`icon-box ${color}`}><Icon name={icon} size={18}/></span><div><strong>{title}</strong><span>{time}</span></div><span className={`activity-reward ${color}`}>{reward}</span></div>)}</section>
      </div>
      <div className="side-column">
        <section className="card missions"><div className="section-head"><h3>Nhiệm vụ hôm nay</h3><span className="count-pill">1/3</span></div><p className="card-description">Từng bước nhỏ, đến mục tiêu lớn.</p><div className="mission done"><span className="mission-check"><Icon name="check" size={14}/></span><div><strong>Hoàn thành Bài 3</strong><span>Đã hoàn thành</span></div><span className="xp">+30 XP</span></div><div className="mission"><span className="mission-check"/><div><strong>Làm 10 câu luyện tập</strong><div className="mini-progress"><Progress value={60}/><span>6/10</span></div></div><span className="xp">+50 XP</span></div><div className="mission"><span className="mission-check"/><div><strong>Ôn lại 3 lỗi sai</strong><div className="mini-progress"><Progress value={33}/><span>1/3</span></div></div><span className="xp">+20 XP</span></div><div className="mission-footer"><Icon name="star" size={16}/><span>Hoàn thành tất cả để nhận <strong>+20 XP</strong></span></div></section>
        <section className="card weak-card"><div className="section-head"><h3>Chủ đề cần ôn</h3><Icon name="target" size={19}/></div><div className="topic-label"><strong>Căn thức</strong><span className="badge amber">Cần luyện</span></div><p>Bạn đang gặp khó khăn ở phép biến đổi căn thức. Cùng ôn lại nhé!</p><button className="outline-amber" onClick={startPractice}>Ôn ngay <Icon name="arrow" size={16}/></button></section>
        <section className="ai-card"><span className="ai-spark"><AIOrb size="teaser" decorative/></span><h3>Có bài nào chưa hiểu?</h3><p>Trợ lý AI sẽ hướng dẫn từng bước để bạn tự tìm ra lời giải.</p><button onClick={() => go('Trợ lý AI')}>Hỏi Trợ lý AI <Icon name="arrow" size={16}/></button><span className="ai-decoration">✧</span></section>
        <section className="card achievements-preview"><div className="section-head"><h3>Thành tích mới nhất</h3><button className="text-button" onClick={() => go('Thành tích')}><Icon name="arrow" size={17}/></button></div><div className="badges-preview">{(['fire','target','award'] as IconName[]).map((icon,i) => <div key={icon}><div className={`medal medal-${i}`}><Icon name={icon} size={25}/></div><span>{['7 ngày\nliên tiếp','100 câu\nchính xác','Chinh phục\nchương 1'][i]}</span></div>)}</div></section>
      </div>
    </div>
    <div className="dashboard-footer"><span>Học một chút mỗi ngày, vững vàng hơn mỗi tuần.</span><span>MATH MENTOR · ĐỒNG HÀNH CÙNG EM</span></div>
  </>;
  const curriculum = () => <>
    <Heading title="Chương trình học" sub="Học theo từng chủ đề và theo dõi tiến độ của bạn."/>
    <div className="toolbar">
      <div className="search-field"><Icon name="search"/><input aria-label="Tìm bài học" placeholder="Tìm chủ đề, bài học..." value={search} onChange={e => setSearch(e.target.value)}/></div>
      <div className="tabs">{['Tất cả','Đang học','Hoàn thành'].map(t => <button className={filter === t ? 'selected' : ''} onClick={() => setFilter(t)} key={t}>{t}</button>)}</div>
    </div>
    {curriculumChapters.map(chapter => <details className="card chapter" open={chapter.number < 3} key={chapter.id}>
      <summary>
        <span className="chapter-number">0{chapter.number}</span>
        <div><span className="eyebrow">CHƯƠNG {chapter.number}</span><h3>{chapter.title}</h3></div>
        <div className="chapter-progress"><span>{chapter.progress}% hoàn thành</span><Progress value={chapter.progress}/></div>
      </summary>
      {chapter.lessons.filter(lesson => lesson.title.toLowerCase().includes(search.toLowerCase()) && (filter === 'Tất cả' || filter === lesson.status)).map(lesson => <button className="lesson-row" key={lesson.id} onClick={() => go('Bài học chi tiết')}>
        <span className={`lesson-icon ${lesson.status === 'Hoàn thành' ? 'complete' : ''}`}><Icon name={lesson.status === 'Hoàn thành' ? 'check' : 'book'}/></span>
        <div><span>Bài {lesson.number}</span><strong>{lesson.title}</strong></div>
        <span className={`badge ${lesson.status === 'Hoàn thành' ? 'green' : lesson.status === 'Đang học' ? 'indigo' : 'neutral'}`}>{lesson.status}</span>
        <Icon name="arrow" size={18}/>
      </button>)}
    </details>)}
  </>;
  const lesson = () => <><div className="breadcrumb">Chương 2 <span>/</span> Hàm số <span>/</span> Bài 3</div><Heading title="Hàm số bậc nhất" sub="Hiểu định nghĩa, đồ thị và cách áp dụng hàm số bậc nhất."/><div className="lesson-stepper">{['Lý thuyết','Ví dụ','Luyện tập','Hoàn thành'].map((s,i) => <button key={s} className={i === 0 ? 'current' : ''} onClick={() => i === 2 ? startPractice() : document.getElementById(i === 1 ? 'example' : 'concept')?.scrollIntoView({behavior:'smooth'})}><span>{i+1}</span>{s}</button>)}</div><div className="reading-layout"><article className="card reading"><div className="eyebrow">KIẾN THỨC TRỌNG TÂM</div><h2 id="concept">1. Khái niệm</h2><p>Hàm số bậc nhất là hàm số được cho bởi công thức:</p><div className="formula">y = ax + b <small>với a, b là các số cho trước và a ≠ 0.</small></div><div className="note"><Icon name="star"/><div><strong>Điều cần nhớ</strong><p>Hàm số đồng biến khi a &gt; 0, nghịch biến khi a &lt; 0. Đồ thị là một đường thẳng cắt trục tung tại điểm có tung độ b.</p></div></div><h2 id="example">2. Ví dụ minh họa</h2><p>Cho hàm số <span className="inline-math">y = 2x + 3</span>. Tính y khi x = 4.</p>{['Thay x = 4 vào công thức đã cho.','y = 2 × 4 + 3','y = 11'].map((s,i) => <div className="solution-step" key={s}><span>{i+1}</span><div><small>BƯỚC {i+1}</small><p className={i > 0 ? 'inline-math' : ''}>{s}</p></div></div>)}<button className="help-button" onClick={() => {go('Trợ lý AI'); send('Em chưa hiểu hàm số bậc nhất.');}}><Icon name="ai"/>Em chưa hiểu <Icon name="arrow" size={17}/></button><div className="reading-footer"><Button secondary onClick={() => go('Chương trình học')}>Bài trước</Button><Button onClick={() => { notify('Đã đánh dấu hoàn thành bài học.'); startPractice(); }}>Luyện tập <Icon name="arrow" size={16}/></Button></div></article><aside className="card contents"><h3>Mục lục bài học</h3><a href="#concept">1. Khái niệm</a><a href="#example">2. Ví dụ minh họa</a><hr/><span>Tiến độ bài học</span><Progress value={72}/><small>Đã hoàn thành 72%</small></aside></div></>;
  const practice = () => <div className="practice-page">
    <Heading title="Luyện tập" sub="Luyện đúng trọng tâm, tiến bộ mỗi ngày."/>
    <section className="continue-card practice-hero">
      <div className="practice-intro">
        <div className="eyebrow"><span className="live-dot"/>ĐỀ XUẤT DÀNH CHO EM</div>
        <h2>Luyện tập hôm nay <span>· Căn thức</span></h2>
        <p>10 câu · khoảng 15 phút · phù hợp với trình độ của em</p>
        <Button onClick={() => practiceActive ? go('Câu luyện tập') : startPractice()}>{practiceActive ? 'Tiếp tục phiên luyện' : 'Bắt đầu luyện'} <Icon name="arrow" size={18}/></Button>
      </div>
      <div className="practice-graph" aria-hidden="true">
        <span className="math-annotation">y = √x</span>
        <svg viewBox="0 0 300 210" fill="none">
          <defs><pattern id="practice-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" stroke="currentColor" strokeOpacity=".09"/></pattern></defs>
          <rect x="12" y="12" width="264" height="168" fill="url(#practice-grid)"/>
          <path d="M36 174H278M60 192V12" stroke="currentColor" strokeOpacity=".28"/>
          <path d="M60 174C69 113 106 90 144 72S218 45 264 30" stroke="currentColor" strokeWidth="2"/>
          <path d="M144 72V174M60 72H144" stroke="currentColor" strokeOpacity=".22" strokeDasharray="3 5"/>
          <circle cx="60" cy="174" r="4" fill="white" stroke="currentColor" strokeWidth="2"/>
          <circle cx="144" cy="72" r="4" fill="white" stroke="currentColor" strokeWidth="2"/>
          <circle cx="264" cy="30" r="4" fill="white" stroke="currentColor" strokeWidth="2"/>
          <circle cx="144" cy="72" r="17" stroke="currentColor" strokeOpacity=".12"/>
        </svg>
        <span className="math-footnote">√x · x ≥ 0</span>
      </div>
    </section>
    <section className="difficulty-section">
      <h3 className="block-title">Luyện theo mức độ</h3>
      <div className="four-grid difficulty-grid">{['Cơ bản','Thông hiểu','Vận dụng','Nâng cao'].map((t,i) => <button className="card difficulty-card" onClick={startPractice} key={t}>
        <div className="difficulty-heading"><span className="difficulty-number">0{i+1}</span><span className="difficulty-indicator" aria-label={`Mức ${i+1} trên 4`}>{[0,1,2,3].map(n=><i className={n<=i?'filled':''} key={n}/>)}</span></div>
        <h3>{t}</h3><p>{['Nắm chắc kiến thức nền tảng','Hiểu và áp dụng công thức','Kết nối các kiến thức đã học','Thử sức với bài toán mở rộng'][i]}</p>
        <span className="text-button">Bắt đầu <Icon name="arrow" size={18}/></span>
      </button>)}</div>
    </section>
    <section className="mistake-section"><h3 className="block-title">Luyện chữa lỗi</h3>
      <div className="inline-card mistake-action"><span className="notebook-icon"><Icon name="errors" size={24}/></span><div><h3>8 lỗi sai đang chờ em ôn lại</h3><p>Hiểu lỗi hôm qua, làm tốt hơn hôm nay.</p></div><Button secondary onClick={() => go('Sổ lỗi sai')}>Mở sổ lỗi sai <Icon name="arrow" size={18}/></Button></div>
    </section>
  </div>;
  const questionScreen = () => {
    const currentQuestion = practiceQuestions[question - 1];
    const correct = answer !== null && currentQuestion.options[answer] === currentQuestion.correctAnswer;
    const checkOrContinue = () => {
      if (answer === null) return;
      if (!feedback) {
        setPracticeResponses(current => recordPracticeResponse(current, currentQuestion, currentQuestion.options[answer]));
        setFeedback(true);
      } else if (!correct) {
        setFeedback(false); setAnswer(null);
      } else if (question === practiceQuestions.length) {
        setPracticeActive(false);
        go('Hoàn thành');
      } else {
        setQuestion(question + 1); setAnswer(null); setFeedback(false);
      }
    };
    return <>
      <div className="focus-header"><button className="text-button" onClick={() => go('Luyện tập')}>← Quay lại</button><strong>Câu {question} / {practiceQuestions.length}</strong><span className="streak">{practiceSummary.streak} câu đúng lần đầu liên tiếp</span></div>
      <Progress value={practiceSummary.checked / practiceSummary.total * 100}/>
      <div className="question-layout"><section className="card question-card">
        <span className="badge indigo">Thông hiểu</span><h2>Cho hàm số</h2><div className="formula">y = 2x + 3</div><p className="question-prompt">Tính y khi x = {currentQuestion.x}.</p>
        <div className="answers">{currentQuestion.options.map((value, index) => <button disabled={feedback} onClick={() => setAnswer(index)} className={`answer ${answer === index ? 'chosen' : ''} ${feedback && value === currentQuestion.correctAnswer ? 'correct' : ''} ${feedback && answer === index && value !== currentQuestion.correctAnswer ? 'incorrect' : ''}`} key={value}><span>{'ABCD'[index]}</span><strong>{value}</strong>{answer === index && <Icon name="check"/>}</button>)}</div>
        {feedback && <div className={`feedback ${correct ? 'success' : 'wrong'}`}><h3>{correct ? 'Chính xác! Rất tốt.' : 'Chưa đúng, mình thử lại nhé.'}</h3><p>{correct ? `Thay x = ${currentQuestion.x} vào công thức. Ta được y = 2 × ${currentQuestion.x} + 3 = ${currentQuestion.correctAnswer}.` : 'Hãy nhân giá trị x với 2 trước, sau đó cộng thêm 3.'}</p>{correct && <strong>+15 XP demo cho câu này</strong>}</div>}
        <div className="question-actions"><button className="text-button" onClick={() => notify('Gợi ý: Thay giá trị x vào công thức, thực hiện phép nhân trước phép cộng.')}>Xem gợi ý</button><Button disabled={answer === null} onClick={checkOrContinue}>{!feedback ? 'Kiểm tra' : !correct ? 'Thử lại' : 'Tiếp tục'}<Icon name="arrow" size={16}/></Button></div>
      </section></div>
    </>;
  };
  const completion = (test = false) => {
    if (test && !examResult) return <div className="completion card">
      <span className="completion-icon"><Icon name="test" size={40}/></span><h1>Kết quả bài kiểm tra</h1><p>{examConfig.title}</p>
      <p>Chưa có kết quả đã nộp của đề này trong phiên trình duyệt. Lịch sử mẫu không có bài làm để chấm điểm.</p>
      <div className="button-row"><Button onClick={() => go(examConfig.room ? 'Phòng thi' : 'Kiểm tra')}>Quay lại danh sách</Button><Button secondary onClick={startPractice}>Luyện tiếp</Button></div>
    </div>;
    const result = test ? examResult : null;
    const accuracy = result ? Math.round(result.correctCount / Math.max(1, result.gradedCount) * 100) : practiceSummary.accuracy;
    const needsReview = result ? result.gradedCount - result.correctCount : practiceSummary.mistakeIds.length;
    const elapsed = result ? `${String(Math.floor(result.elapsedSeconds / 60)).padStart(2, '0')}:${String(result.elapsedSeconds % 60).padStart(2, '0')}` : '';
    return <div className="completion card">
      <span className="completion-icon"><Icon name={test ? 'test' : 'award'} size={40}/></span><h1>{test ? 'Kết quả bài kiểm tra' : 'Hoàn thành!'}</h1>
      <p>{result ? result.title : 'Mỗi câu hỏi là một bước tiến. Em đã làm rất tốt!'}</p>
      <div className="big-score">{result ? result.earnedPoints : practiceSummary.firstCorrect}<span> / {result ? result.maxGradedPoints : practiceSummary.total}</span></div>
      <p>{result ? `Điểm demo phần có đáp án (${result.gradedCount} câu). ${result.pendingCount} câu tự luận chưa được chấm; chưa có điểm toàn bài / ${result.totalPoints}.` : `Đúng lần đầu: ${practiceSummary.firstCorrect}/${practiceSummary.total}. Đã làm đúng sau các lượt thử: ${practiceSummary.corrected}/${practiceSummary.total}.`}</p>
      {result && <p>{result.reason === 'expired' ? 'Hết giờ: phiên thi đã tự đóng, không thể sửa đáp án.' : 'Đã đóng phiên thi theo yêu cầu nộp bài.'} Kết quả được tính cục bộ, chưa gửi đến giáo viên.</p>}
      <div className="completion-stats"><div><strong>{accuracy}%</strong><span>{result ? 'Đúng phần có đáp án' : 'Đúng lần đầu'}</span></div><div><strong>{result ? elapsed : `+${practiceSummary.xp} XP`}</strong><span>{result ? 'Thời gian làm bài' : 'XP demo trong phiên'}</span></div><div><strong>{needsReview}</strong><span>{result ? 'Sai / bỏ trống phần có đáp án' : 'Câu cần ôn lại'}</span></div></div>
      <div className="mastery-row"><span>{result ? 'Phần có đáp án' : 'Hàm số · phiên này'}</span><Progress value={accuracy}/><span className={`badge ${accuracy >= 70 ? 'green' : 'amber'}`}>{accuracy}%</span></div>
      <div className="mastery-row"><span>{result ? 'Tự luận' : 'Căn thức'}</span><Progress value={0}/><span className="badge neutral">{result ? `${result.pendingCount} câu chưa chấm` : 'Chưa có dữ liệu'}</span></div>
      <div className="button-row"><Button onClick={() => go('Sổ lỗi sai')}>Sổ lỗi sai mẫu</Button><Button secondary onClick={startPractice}>Luyện tiếp</Button></div>
    </div>;
  };
  const tests = () => <>
    <Heading title={page} sub={page === 'Phòng thi' ? 'Sẵn sàng thử sức và chinh phục mục tiêu vào lớp 10.' : 'Kiểm tra kiến thức, nhận biết phần cần cải thiện.'}/>
    <div className="tabs margin-bottom">{['Đang mở','Sắp tới','Đã làm'].map(t => <button className={filter === t || filter === 'Tất cả' && t === 'Đang mở' ? 'selected' : ''} onClick={() => setFilter(t)} key={t}>{t}</button>)}</div>
    <div className="two-grid">{[1,2,3].map(index => {
      const config = getDemoExamConfig(index, page === 'Phòng thi');
      return <section className="card exam-card" key={config.id}>
        <div className="section-head"><span className="icon-box purple"><Icon name="test"/></span><span className={`badge ${filter === 'Đã làm' ? 'green' : 'indigo'}`}>{filter === 'Tất cả' ? 'Đang mở' : filter}</span></div>
        <h3>{config.title}</h3><p>{config.count} câu · {config.minutes} phút</p><p>Hạn làm bài: 18:00 · 15/10/2026</p>
        <Button onClick={() => { if (filter === 'Đã làm') viewExamResult(config); else { setExamConfig(config); setExamResult(null); go('Làm bài kiểm tra'); } }}>{filter === 'Đã làm' ? 'Xem kết quả' : config.room ? 'Vào phòng thi' : 'Làm bài'}<Icon name="arrow" size={16}/></Button>
      </section>;
    })}</div>
  </>;

  tutorVisited.current ||= !admin && page === 'Trợ lý AI';
  const ai = () => tutorVisited.current ? <Suspense fallback={<div className="card" role="status">Đang tải trợ lý toán học…</div>}><AiTutor active={!admin && page === 'Trợ lý AI'} message={message} setMessage={setMessage} externalRequest={externalRequest} onSolveRequest={() => setModal('Em muốn thử thêm một gợi ý không?')}/></Suspense> : null;
  const errors = () => <><Heading title="Sổ lỗi sai" sub="Biến những lỗi đã mắc thành kiến thức bạn sẽ không quên."/><div className="three-grid summary-cards">{[['Tổng lỗi','24'],['Chưa chữa','8'],['Đã chữa','16']].map(([t,v]) => <div className="card" key={t}><p>{t}</p><h2>{v}</h2></div>)}</div><div className="tabs margin-bottom">{['Tất cả','Chưa chữa','Đã chữa'].map(t => <button className={filter === t ? 'selected' : ''} onClick={() => setFilter(t)} key={t}>{t}</button>)}</div>{['Quên điều kiện xác định','Nhầm công thức','Sai khi chuyển vế'].map((t,i) => <section className="card error-item" key={t}><div className="section-head"><span className="badge amber">{t}</span><span className="muted">12/10/2026 · Chương {i+1}</span></div><h3>{['Tìm điều kiện xác định của √(x − 2).','Rút gọn √(a²) với a < 0.','Giải phương trình 2x + 3 = 7.'][i]}</h3><div className="error-answers"><span>Bài làm của em: <s>{['x > 2','a','x = 5'][i]}</s></span><span>Đáp án đúng: <strong>{['x ≥ 2','−a','x = 2'][i]}</strong></span></div><div className="section-head"><span className={`badge ${filter === 'Đã chữa' ? 'green' : 'neutral'}`}>{filter === 'Đã chữa' ? 'Đã chữa' : 'Chưa chữa'}</span><Button secondary onClick={startPractice}>Luyện chữa lỗi <Icon name="arrow" size={16}/></Button></div></section>)}</>;
  const progress = () => <><Heading title="Tiến độ học tập" sub="Nhìn lại hành trình và những tiến bộ của em."/><div className="four-grid summary-cards">{[['Số câu đã làm','486'],['Tỷ lệ đúng','78%'],['Thời gian học','31 giờ'],['Chuỗi ngày','12 ngày']].map(([t,v]) => <div className="card" key={t}><p>{t}</p><h2>{v}</h2><small className="growth">↗ Tiến bộ so với tuần trước</small></div>)}</div><div className="two-grid"><section className="card"><div className="section-head"><h3>Số câu đã làm</h3><span className="badge neutral">Tuần này</span></div><Chart large/></section><section className="card"><h3>Mức độ nắm vững kiến thức</h3>{[['Hàm số',88],['Căn thức',62],['Hệ phương trình',42],['Hình học',75]].map(([t,v]) => <div className="topic-mastery" key={t}><div className="section-head"><strong>{t}</strong><span className={`badge ${Number(v)>70?'green':Number(v)>50?'amber':'red'}`}>{Number(v)>70?'Tốt':Number(v)>50?'Cần luyện':'Cần củng cố'} · {v}%</span></div><Progress value={Number(v)}/></div>)}</section></div><section className="card block-title"><h3>Lịch sử kiểm tra (dữ liệu mẫu)</h3><div className="table-wrap"><table><thead><tr><th>Bài kiểm tra</th><th>Ngày làm</th><th>Điểm</th><th>Thời gian</th><th/></tr></thead><tbody>{[1,2,3].map(i => <tr key={i}><td>Kiểm tra 15 phút · Chương {i}</td><td>{13-i}/10/2026</td><td><strong>{i === 1 ? '8.5' : '8.0'}</strong></td><td>13 phút 42 giây</td><td><button className="text-button" onClick={() => viewHistoryResult(i)}>Xem kết quả</button></td></tr>)}</tbody></table></div></section></>;
  const roadmap = () => <><Heading title="Lộ trình của em" sub="Một kế hoạch vừa sức, dành riêng cho mục tiêu của em."/><div className="card goal-card"><Icon name="target" size={34}/><div><span>MỤC TIÊU HỌC TẬP</span><h2>8.5 điểm</h2></div><div><span>THỜI GIAN MỖI NGÀY</span><h2>25 phút</h2></div><span className="badge indigo">Tuần 12 – 18 tháng 10</span></div><div className="reading-layout"><section className="card">{['Ôn Căn thức','Chữa lỗi sai','Học Hàm số','Luyện 10 câu','Ôn chủ đề yếu','Luyện tổng hợp','Đề 15 phút'].map((t,i) => <div className={`timeline-item ${i===1?'current':''}`} key={t}><span className="timeline-dot">{i===0?<Icon name="check" size={16}/>:i+1}</span><div><small>{i===6?'CHỦ NHẬT':`THỨ ${i+2}`}</small><h3>{t}</h3><span>{i===1?'15':'25'} phút · {i===0?'Hoàn thành':i===1?'Hôm nay':'Sắp tới'}</span></div>{i===1 && <Button onClick={startPractice}>Bắt đầu</Button>}</div>)}</section><aside className="card contents"><Icon name="ai"/><h3>Vì sao hệ thống đề xuất?</h3><p>Em đang cần củng cố phần Căn thức nên lộ trình ưu tiên ôn chủ đề này trước khi học kiến thức mới.</p></aside></div></>;
  const achievements = () => <><Heading title="Thành tích" sub="Mỗi nỗ lực đều xứng đáng được ghi nhận."/><section className="card level-card"><div className="medal medal-1"><Icon name="award" size={35}/></div><div><h2>Cấp 8 · Nhà chinh phục</h2><p>1.850 / 2.200 XP · Còn 350 XP để lên cấp 9</p><Progress value={84}/></div><span className="badge amber"><Icon name="fire" size={16}/>12 ngày liên tiếp</span></section><div className="three-grid">{['7 ngày liên tiếp','100 câu đúng','Hoàn thành chương đầu tiên','Không bỏ cuộc','Nhà chinh phục Hàm số','250 câu chính xác'].map((t,i) => <section className={`card achievement-card ${i>3?'locked':''}`} key={t}><div className={`medal medal-${i%3}`}><Icon name={i%2?'award':'fire'} size={35}/></div><h3>{t}</h3><p>{i>3?'Còn 32 câu đúng để mở khóa.':'Đã mở khóa · 10/10/2026'}</p><span className={`badge ${i>3?'neutral':'green'}`}>{i>3?'Chưa mở khóa':'Đã đạt'}</span></section>)}</div></>;
  const notifications = () => <><Heading title="Thông báo" sub="Cập nhật học tập và những điều quan trọng dành cho em."><Button secondary onClick={() => {setFilter('Đã đọc'); notify('Đã đánh dấu tất cả là đã đọc.');}}>Đánh dấu đã đọc</Button></Heading><div className="tabs margin-bottom">{['Tất cả','Chưa đọc'].map(t => <button className={filter===t?'selected':''} onClick={() => setFilter(t)} key={t}>{t}</button>)}</div><section className="card notifications">{['Bạn còn 1 nhiệm vụ hôm nay','Bạn đã nhận huy hiệu mới','Có đề kiểm tra mới','Nên ôn lại Căn thức','Lộ trình tuần mới đã sẵn sàng','Thầy cô vừa thêm bài học mới'].map((t,i) => <button className={`notification-row ${filter!=='Đã đọc'&&i<3?'unread':''}`} key={t} onClick={() => go(['Trang chủ','Thành tích','Kiểm tra','Luyện tập','Lộ trình','Chương trình học'][i])}><span className={`icon-box ${i%2?'purple':'blue'}`}><Icon name={(['target','award','test','book','route','book'] as IconName[])[i]}/></span><div><strong>{t}</strong><p>{['Hoàn thành nhiệm vụ để nhận thêm 20 XP nhé.','Chúc mừng em đã học 7 ngày liên tiếp!','Kiểm tra 15 phút · Chương 2 đã được mở.','Dành 15 phút ôn phép biến đổi căn thức nhé.','Khám phá kế hoạch học tập dành riêng cho em.','Bài 3 · Đồ thị hàm số y = ax + b.'][i]}</p><small>{i===0?'10 phút trước':`${i+1} giờ trước`}</small></div>{filter!=='Đã đọc'&&i<3&&<span className="live-dot"/>}</button>)}</section></>;
  const profile = () => <><Heading title="Hồ sơ của em" sub="Thông tin cá nhân và cài đặt học tập."/><section className="card profile-main"><div className="avatar large-avatar">MA</div><h2>Nguyễn Minh Anh</h2><p>Lớp 9A1 · Cấp 8 · 1.850 XP</p><div className="profile-fields">{['Họ và tên','Tên đăng nhập','Lớp','Ngày tham gia'].map((t,i) => <label key={t}>{t}<input defaultValue={['Nguyễn Minh Anh','minhanh.9a1','9A1','01/09/2026'][i]} readOnly={i>0}/></label>)}</div><Button onClick={() => notify('Đã lưu thông tin hồ sơ.')}>Lưu thay đổi</Button></section><section className="card block-title"><ThemeSwitcher settings/>{['Đổi mật khẩu','Thông báo','Cài Math Mentor','Chuyển sang giao diện quản trị'].map(t => <button className="settings-row" key={t} onClick={() => t.includes('quản trị') ? (setAdmin(true),go('Tổng quan')) : t==='Đổi mật khẩu'?setModal('Đổi mật khẩu'):go(t)}>{t}<Icon name="arrow" size={18}/></button>)}</section></>;
  const tools = () => <><Heading title="Công cụ Toán" sub="Những công cụ hỗ trợ em khám phá và kiểm tra kiến thức."/><div className="tabs margin-bottom">{['Bảng công thức','Máy tính','Vẽ đồ thị','Kiểm tra biểu thức'].map(t => <button className={filter===t||filter==='Tất cả'&&t==='Bảng công thức'?'selected':''} onClick={() => setFilter(t)} key={t}>{t}</button>)}</div>{filter==='Tất cả'||filter==='Bảng công thức'?<div className="two-grid">{[['Hằng đẳng thức','(a + b)² = a² + 2ab + b²'],['Hiệu hai bình phương','a² − b² = (a − b)(a + b)'],['Hàm số bậc nhất','y = ax + b, a ≠ 0'],['Định lý Pythagore','a² + b² = c²']].map(([t,f]) => <section className="card" key={t}><h3>{t}</h3><div className="formula small">{f}</div></section>)}</div>:<section className="card tool-panel"><h3>{filter}</h3><label>Biểu thức<input placeholder={filter==='Vẽ đồ thị'?'y = 2x + 3':'2 × 4 + 3'} value={toolExpression} onChange={e=>setToolExpression(e.target.value)}/></label>{filter==='Kiểm tra biểu thức'&&<label>Biểu thức thứ hai<input value={secondToolExpression} onChange={e=>setSecondToolExpression(e.target.value)} placeholder="Nhập biểu thức cần đối chiếu"/></label>}<Button onClick={()=>notify('Công cụ này cần kết nối bộ xử lý toán học để tính toán chính xác.')}>Kiểm tra</Button><p className="muted">Nhập biểu thức toán học để bắt đầu.</p></section>}</>;
  const pwa = () => <><Heading title="Cài Math Mentor" sub="Học tập thuận tiện ngay từ màn hình chính."/><section className="card pwa-card"><div className="brand-mark big-brand">√</div><h2>Đưa Math Mentor ra màn hình chính</h2><p>Math Mentor sẽ mở như một ứng dụng bình thường.</p><Button onClick={()=>notify('Mở menu trình duyệt và chọn “Cài đặt ứng dụng” hoặc “Thêm vào màn hình chính”.')}>Cài đặt ứng dụng</Button><h3>Trên iPhone</h3>{['Mở Math Mentor bằng Safari','Nhấn nút Chia sẻ','Chọn Thêm vào Màn hình chính'].map((t,i)=><div className="solution-step" key={t}><span>{i+1}</span><p>{t}</p></div>)}</section></>;
  const adminDashboard = () => <><Heading title="Tổng quan" sub="Theo dõi hoạt động học tập của học sinh."/><div className="four-grid summary-cards">{[['Tổng học sinh','100'],['Hoạt động hôm nay','64'],['Bài làm tuần này','327'],['Lượt AI tháng này','1.284']].map(([t,v])=><section className="card" key={t}><p>{t}</p><h2><AnimatedCount value={v} reducedMotion={reducedMotion}/></h2><small className="growth">↗ 12% so với tuần trước</small></section>)}</div><div className="two-grid"><section className="card"><h3>Hoạt động học tập 7 ngày</h3><Chart large/></section><section className="card"><h3>Học sinh cần chú ý</h3>{['Trần Minh Anh','Nguyễn Hoàng Nam','Lê Thanh Hà'].map((t,i)=><div className="activity-row" key={t}><span className="avatar">{t.split(' ').slice(-1)[0].slice(0,2).toUpperCase()}</span><div><strong>{t}</strong><span>{['3 ngày chưa học','Tỷ lệ đúng 42%','8 lỗi sai chưa chữa'][i]}</span></div><button className="text-button" onClick={()=>go('Học sinh')}>Xem</button></div>)}</section></div><h3 className="block-title">Kết quả gần đây</h3>{adminTable('Kết quả')}</>;
  const adminTable = (name: string) => {
    const table = getAdminTableData(name);
    const student = table.kind === 'student';
    const questions = table.kind === 'question';
    const visibleRows = table.rows.filter(row => row.title.toLowerCase().includes(search.toLowerCase()));
    return <section className="card table-card">
      <div className="table-wrap"><table>
        <thead><tr><th><input type="checkbox" aria-label="Chọn tất cả"/></th><th>{student?'Họ và tên':questions?'Nội dung câu hỏi':'Tên nội dung'}</th><th>{student?'Nhóm':'Chủ đề'}</th><th>{questions?'Mức độ':student?'Tỷ lệ đúng':'Số câu / bài'}</th><th>Trạng thái</th><th>Cập nhật</th><th/></tr></thead>
        <tbody>{visibleRows.map(row => <tr key={row.id}>
          <td><input type="checkbox" aria-label={`Chọn ${row.title}`}/></td>
          <td><strong>{row.title}</strong><small>{row.subtitle}</small></td>
          <td>{row.groupOrTopic}</td>
          <td>{row.value}</td>
          <td><span className={`badge ${row.status === 'Bản nháp' ? 'neutral' : 'green'}`}>{row.status}</span></td>
          <td>{row.updatedAt}</td>
          <td><button className="text-button" onClick={()=>setModal(student?'Hồ sơ học sinh':'Chỉnh sửa nội dung')}>Sửa</button></td>
        </tr>)}</tbody>
      </table></div>
      <div className="table-footer"><span>Hiển thị {visibleRows.length ? `1–${visibleRows.length}` : '0'} trong {table.totalCount} mục</span><div><button onClick={()=>notify('Đang ở trang đầu tiên.')}>←</button><button className="selected">1</button><button onClick={()=>notify('Chưa có thêm dữ liệu trong bản mẫu.')}>2</button><button onClick={()=>notify('Chưa có thêm dữ liệu trong bản mẫu.')}>→</button></div></div>
    </section>;
  };
  const adminContent = () => {
    if(page==='Tổng quan') return adminDashboard();
    if(page==='Cài đặt') return <><Heading title="Cài đặt" sub="Quản lý cấu hình ứng dụng và giới hạn sử dụng."/><section className="card settings-panel"><h3>Trợ lý AI</h3><div className="settings-row"><div><strong>Bật Trợ lý AI</strong><p>Cho phép học sinh sử dụng trợ lý học tập.</p></div><button className={`toggle ${aiEnabled?'on':''}`} role="switch" aria-checked={aiEnabled} onClick={()=>setAiEnabled(!aiEnabled)}><span/></button></div>{!aiEnabled&&<div className="note">Trợ lý AI đang tạm tắt. Học sinh vẫn có thể học và luyện tập bình thường.</div>}<label>Giới hạn mỗi học sinh / ngày<input type="number" defaultValue={20} disabled={!aiEnabled}/></label><label>Giới hạn hàng tháng<input type="number" defaultValue={5000} disabled={!aiEnabled}/></label><label>Ngưỡng cảnh báo (%)<input type="number" defaultValue={80}/></label><Button onClick={()=>notify('Đã lưu cài đặt.')}>Lưu cài đặt</Button></section></>;
    if(page==='Thông báo') return <><Heading title="Thông báo" sub="Gửi thông tin học tập đến học sinh và các nhóm."/><section className="card settings-panel"><h3>Tạo thông báo</h3><label>Tiêu đề<input placeholder="Ví dụ: Lịch kiểm tra giữa học kỳ"/></label><label>Nội dung<textarea rows={5} placeholder="Nhập nội dung thông báo..."/></label><label>Đối tượng<select><option>Tất cả học sinh</option><option>Lớp 9A1</option><option>Lớp 9A2</option></select></label><Button onClick={()=>notify('Bản mẫu: thông báo chưa được gửi đến tài khoản thật.')}>Gửi thông báo</Button></section></>;
    return <><Heading title={page==='Câu hỏi'?'Ngân hàng câu hỏi':page} sub={page==='Câu hỏi'?'Quản lý câu hỏi, mức độ và lời giải trong chương trình Toán 9.':'Quản lý nội dung và hoạt động học tập của lớp.'}><div className="button-row">{page==='Câu hỏi'&&<Button secondary onClick={()=>setModal('Nhập Excel / CSV')}><Icon name="upload" size={16}/>Nhập Excel / CSV</Button>}<Button onClick={()=>setModal(page==='Câu hỏi'?'Thêm câu hỏi':page==='Đề kiểm tra'?'Tạo đề kiểm tra':page==='Phòng thi'?'Tạo phòng thi':`Thêm ${page.toLowerCase()}`)}><Icon name="plus" size={16}/>{page==='Câu hỏi'?'Thêm câu hỏi':page==='Đề kiểm tra'?'Tạo đề':page==='Phòng thi'?'Tạo phòng':`Thêm ${page.toLowerCase()}`}</Button></div></Heading>{page==='Câu hỏi'&&<div className="four-grid summary-cards">{[['Tổng câu hỏi','248'],['Cơ bản','96'],['Thông hiểu','84'],['Vận dụng & nâng cao','68']].map(([t,v])=><section className="card" key={t}><p>{t}</p><h2>{v}</h2></section>)}</div>}<div className="toolbar"><div className="search-field"><Icon name="search"/><input placeholder="Tìm kiếm..." aria-label="Tìm kiếm nội dung" value={search} onChange={e=>setSearch(e.target.value)}/></div><select aria-label="Chọn chủ đề"><option>Tất cả chủ đề</option><option>Căn thức</option><option>Hàm số</option></select><select aria-label="Chọn mức độ"><option>Tất cả mức độ</option><option>Cơ bản</option><option>Thông hiểu</option></select></div>{adminTable(page)}</>;
  };
  const content = () => { if(admin) return adminContent(); switch(page){case 'Trang chủ':return dashboard(); case 'Chương trình học':return curriculum(); case 'Bài học chi tiết':return lesson(); case 'Luyện tập':return practice(); case 'Câu luyện tập':return questionScreen(); case 'Làm bài kiểm tra':return <ExamRoom key={examConfig.id} config={examConfig} onExit={() => go(examConfig.room ? 'Phòng thi' : 'Kiểm tra')} onSubmit={finishExam}/>; case 'Hoàn thành':return completion(); case 'Kết quả bài kiểm tra':return completion(true); case 'Kiểm tra':case 'Phòng thi':return tests(); case 'Trợ lý AI':return null; case 'Sổ lỗi sai':return errors(); case 'Tiến độ':return progress(); case 'Lộ trình':return roadmap(); case 'Thành tích':return achievements(); case 'Thông báo':return notifications(); case 'Hồ sơ':return profile(); case 'Công cụ Toán':return tools(); case 'Cài Math Mentor':return pwa(); default:return dashboard();}};
  return <div ref={appRef} style={motionVariables} data-theme={dark ? 'dark' : 'light'} className={`app ${focus?'focus-mode':''} ${isTest && !admin ? 'exam-shell' : ''} ${page === 'Luyện tập' && !admin ? 'practice-view' : ''} ${page === 'Câu luyện tập' ? 'practice-session' : ''} ${page === 'Trợ lý AI' && !admin ? 'ai-image-view' : ''}`}>
    <aside className="sidebar"><button className="brand" onClick={()=>go(admin?'Tổng quan':'Trang chủ')}><span className="brand-mark">√</span><div>MATH MENTOR<small>{admin?'KHÔNG GIAN QUẢN TRỊ':'HỌC TOÁN, HIỂU TỪ GỐC'}</small></div></button><nav>{(admin?[{label:'QUẢN TRỊ',items:adminNav}]:studentNav).map(group=><div className="nav-group" key={group.label}><span className="nav-label">{group.label}</span>{group.items.map(([label,icon])=><button aria-label={label} title={label} className={`nav-item ${active===label?'active':''}`} key={label} onClick={()=>go(label)}><Icon name={icon} size={19}/><span>{label}</span>{label==='Trợ lý AI'&&<span className="ai-mini">AI</span>}{label==='Thông báo'&&<span className="nav-count">3</span>}</button>)}</div>)}</nav><div className="sidebar-bottom"><button className="mode-switch" onClick={()=>{setAdmin(!admin);go(admin?'Trang chủ':'Tổng quan');}}><Icon name={admin?'book':'tools'} size={16}/>{admin?'Giao diện học sinh':'Không gian giáo viên'}<Icon name="arrow" size={14}/></button><button className="profile-block" onClick={()=>go('Hồ sơ')}><span className="avatar">{admin?'HL':'MA'}</span><div><strong>{admin?'Thầy Hoàng Long':'Nguyễn Minh Anh'}</strong><small>{admin?'Giáo viên Toán':'Lớp 9A1'}</small></div><span className="profile-dots">•••</span></button></div></aside>
    <div className="app-body"><header className="topbar"><div className="header-context"><span>{admin?'Quản trị':'Không gian học tập'}</span><span className="header-slash">/</span><strong>{active}</strong></div><div className="header-actions"><ThemeSwitcher/><button className="header-search" onClick={()=>go('Chương trình học')}><Icon name="search" size={18}/><span>Tìm kiếm</span><kbd>⌘ K</kbd></button><span className="header-divider"/>{!admin&&<span className="level-indicator"><Icon name="star" size={17}/>Cấp 8 <span>·</span><strong>1.850 XP</strong></span>}<button className="bell-button" aria-label="Thông báo" onClick={()=>go('Thông báo')}><Icon name="bell"/><i/></button><button className="avatar small-avatar" aria-label="Hồ sơ" onClick={()=>go('Hồ sơ')}>{admin?'HL':'MA'}</button></div></header><main>{content()}<div className="tutor-route" hidden={admin || page !== 'Trợ lý AI'}>{ai()}</div></main></div>
    {admin && <AdminMobileNav items={adminNav.map(([label, icon]) => ({ label, icon: <Icon name={icon} size={22}/> }))} page={page} onNavigate={go} onStudent={() => { setAdmin(false); go('Trang chủ'); }}/> }
    {!admin&&!focus&&<nav className="mobile-nav" aria-label="Điều hướng chính">{([['Trang chủ','home'],['Học','book'],['AI','ai'],['Tiến độ','chart'],['Thêm','tools']] as [string,IconName][]).map(([t,i]) => {
      const selected = t === 'Thêm' ? more : t === 'Học' ? ['Chương trình học','Bài học chi tiết','Luyện tập'].includes(page) : active === ({'AI':'Trợ lý AI'}[t] || t);
      return <button aria-current={selected ? 'page' : undefined} aria-expanded={t === 'Thêm' ? more : undefined} className={`${selected ? 'active' : ''} ${t === 'AI' ? 'mobile-ai-tab' : ''}`} key={t} onClick={()=>t==='Thêm'?setMore(!more):go({'Học':'Chương trình học','AI':'Trợ lý AI'}[t]||t)}><span className="mobile-nav-icon">{t === 'AI' ? <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 5v17h18M8 18c3-1 3-8 7-8s4 4 8-5"/><circle cx="15" cy="10" r="2" fill="currentColor" stroke="none"/><path d="M10 5h3M21 18v3"/></svg> : t === 'Thêm' ? <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg> : <Icon name={i} size={22}/>}</span><span>{t}</span></button>;
    })}</nav>}
    {more&&<div className="sheet-backdrop" onClick={()=>setMore(false)}><div className="mobile-sheet" onClick={e=>e.stopPropagation()}><div className="section-head"><h3>Thêm</h3><button aria-label="Đóng" onClick={()=>setMore(false)}><Icon name="close"/></button></div><ThemeSwitcher settings/>{['Kiểm tra','Phòng thi','Lộ trình','Sổ lỗi sai','Thành tích','Công cụ Toán','Thông báo','Hồ sơ','Cài đặt','Cài Math Mentor'].map(t=><button className="settings-row" key={t} onClick={()=>go(t === 'Cài đặt' ? 'Hồ sơ' : t)}>{t}<Icon name="arrow" size={16}/></button>)}</div></div>}
    {toast&&<div className="toast" role="status"><span className="icon-box green"><Icon name="check" size={16}/></span>{toast}<button aria-label="Đóng thông báo" onClick={()=>setToast('')}><Icon name="close" size={16}/></button></div>}
    {modal&&<div className="modal-backdrop" onClick={()=>setModal('')}><section className="modal" role="dialog" aria-modal="true" aria-label={modal} onClick={e=>e.stopPropagation()}><div className="section-head"><h2>{modal}</h2><button aria-label="Đóng" onClick={()=>setModal('')}><Icon name="close"/></button></div>{modal==='Nộp bài?'?<><p>Em đang xem câu {question} / 15. Hãy kiểm tra lại các câu chưa trả lời trước khi nộp.</p><div className="note">Sau khi nộp bài, em không thể thay đổi câu trả lời.</div><div className="button-row"><Button secondary onClick={()=>setModal('')}>Quay lại làm bài</Button><Button onClick={()=>{setModal('');go('Kết quả bài kiểm tra');notify('Nộp bài thành công.');}}>Nộp bài</Button></div></>:modal.includes('gợi ý')?<><p>Em sẽ hiểu bài sâu hơn nếu thử thêm một bước trước khi xem đáp án.</p><div className="button-row"><Button onClick={()=>{send('Cho em thêm gợi ý', 'hint');setModal('');}}>Cho em thêm gợi ý</Button><Button secondary onClick={()=>{send('Xem lời giải', 'solve');setModal('');}}>Xem lời giải</Button></div></>:modal.includes('Excel')?<><p>Tải file mẫu, chuẩn bị dữ liệu và kiểm tra trước khi nhập.</p><label className="upload-zone"><Icon name="upload" size={30}/><strong>Chọn file Excel / CSV</strong><span>Hỗ trợ .xlsx và .csv</span><input type="file" accept=".csv,.xlsx" onChange={()=>notify('Đã chọn file. Việc nhập dữ liệu cần kết nối hệ thống lưu trữ.')}/></label><Button secondary onClick={()=>{const blob=new Blob(['noi_dung,muc_do,dap_an,loi_giai\\nTính y khi x=2 trong y=2x+3,Cơ bản,7,Thay x=2 vào biểu thức'],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='mau-cau-hoi.csv';a.click();URL.revokeObjectURL(a.href);}}>Tải file mẫu</Button></>:<form onSubmit={e=>{e.preventDefault();setModal('');notify(modal.includes('mật khẩu')?'Bản mẫu: mật khẩu chưa được thay đổi.':'Đã lưu bản mẫu. Dữ liệu chưa được đồng bộ lên máy chủ.');}}><label>{modal.includes('câu hỏi')?'Nội dung câu hỏi':modal.includes('mật khẩu')?'Mật khẩu mới':'Tên nội dung'}<input required type={modal.includes('mật khẩu')?'password':'text'} placeholder={modal.includes('câu hỏi')?'Cho hàm số y = ax + b...':'Nhập thông tin'}/></label><label>{modal.includes('phòng')?'Đề kiểm tra':'Chủ đề'}<select><option>Hàm số bậc nhất</option><option>Căn thức bậc hai</option></select></label>{modal.includes('câu hỏi')&&<><label>Mức độ<select><option>Cơ bản</option><option>Thông hiểu</option><option>Vận dụng</option><option>Nâng cao</option></select></label><label>Đáp án đúng<input required placeholder="Nhập đáp án"/></label><label>Lời giải<textarea rows={3} placeholder="Giải thích từng bước..."/></label></>}{(modal.includes('đề')||modal.includes('phòng'))&&<label>Thời lượng (phút)<input type="number" min={5} defaultValue={45}/></label>}<div className="button-row"><Button secondary onClick={()=>setModal('')}>Hủy</Button><Button>Lưu nội dung</Button></div></form>}</section></div>}
  </div>;
}
