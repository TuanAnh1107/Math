import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ThemeSwitcher, { useTheme } from './Theme';
import { canEditExam, closeExamAttempt, examStore, getExamQuestions, remainingExamSeconds, toggleExamMark, updateExamAnswer, type ExamAttempt, type ExamConfig, type ExamReason, type ExamResult } from './examModel';

export type { ExamConfig, ExamResult } from './examModel';
export { getDemoExamConfig, getSavedExamResult } from './examModel';
type ExamIcon = 'clock' | 'exam' | 'flag' | 'list' | 'close' | 'print' | 'link' | 'check' | 'arrow';
function ExamSymbol({ name }: { name: ExamIcon }) {
  const paths: Record<ExamIcon, React.ReactNode> = {
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    exam: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v4H9zM9 12h6M9 16h4"/></>,
    flag: <path d="M5 21V3h14l-3 5 3 5H5"/>,
    list: <><path d="M9 6h12M9 12h12M9 18h12"/><path d="M3 6h1M3 12h1M3 18h1"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    print: <><path d="M7 8V3h10v5M7 17H3V8h18v9h-4"/><path d="M7 13h10v8H7z"/></>,
    link: <><path d="m10 14 4-4M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(2 0) scale(.85 1)"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
export default function ExamRoom({ config: requestedConfig, onExit, onSubmit }: { config: ExamConfig; onExit: () => void; onSubmit: (result: ExamResult) => void }) {
  const { dark } = useTheme();
  // The loader is idempotent under StrictMode and reuses the same absolute deadline.
  const [stored, setStored] = useState(() => examStore.open(requestedConfig, Date.now()));
  const attempt = stored.attempt;
  const config = attempt.config;
  const questions = useMemo(() => getExamQuestions(config), [config]);
  const attemptRef = useRef(attempt);
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const deliveredRef = useRef<string | null>(null);
  const answers = Object.fromEntries(questions.map(question => [question.number, attempt.answers[question.id] || ''])) as Record<number, string>;
  const marked = questions.filter(question => attempt.marked.includes(question.id)).map(question => question.number);
  const [current, setCurrent] = useState(1);
  const [mode, setMode] = useState<'all' | 'one'>('one');
  const [listOpen, setListOpen] = useState(false);
  const [dialog, setDialog] = useState<'submit' | 'exit' | null>(null);
  const [seconds, setSeconds] = useState(() => remainingExamSeconds(attempt, Date.now()));
  const [notice, setNotice] = useState('');
  const listTrigger = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const completed = Object.values(answers).filter(answer => answer.trim()).length;
  const locked = !canEditExam(attempt, Date.now());
  const saveMessage = stored.persistence === 'session' ? 'Đã lưu trong phiên trình duyệt này' : 'Chỉ giữ tạm trong ứng dụng; tải lại trang sẽ mất bài';
  const deliver = useCallback((closed: ExamAttempt) => {
    if (!closed.result || deliveredRef.current === closed.attemptId) return;
    deliveredRef.current = closed.attemptId;
    setListOpen(false); setDialog(null);
    onSubmitRef.current(closed.result);
  }, []);
  const commit = useCallback((next: ExamAttempt) => {
    const saved = examStore.save(next);
    attemptRef.current = saved.attempt;
    setStored(saved);
    setSeconds(remainingExamSeconds(saved.attempt, Date.now()));
    if (saved.attempt.status === 'closed') deliver(saved.attempt);
  }, [deliver]);
  const finish = useCallback((reason: ExamReason) => {
    commit(closeExamAttempt(attemptRef.current, reason, Date.now()));
  }, [commit]);
  useEffect(() => {
    const checkDeadline = () => {
      const currentAttempt = attemptRef.current;
      if (currentAttempt.status === 'closed') { deliver(currentAttempt); return; }
      setSeconds(remainingExamSeconds(currentAttempt, Date.now()));
      if (Date.now() >= currentAttempt.expiresAt) finish('expired');
    };
    const flush = () => {
      const currentAttempt = attemptRef.current;
      const next = currentAttempt.status === 'active' && Date.now() >= currentAttempt.expiresAt ? closeExamAttempt(currentAttempt, 'expired', Date.now()) : currentAttempt;
      attemptRef.current = examStore.save(next).attempt;
    };
    checkDeadline();
    const interval = window.setInterval(checkDeadline, 1000);
    const deadline = window.setTimeout(checkDeadline, Math.min(2_147_483_647, Math.max(0, attemptRef.current.expiresAt - Date.now())));
    document.addEventListener('visibilitychange', checkDeadline);
    window.addEventListener('focus', checkDeadline);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.clearInterval(interval); window.clearTimeout(deadline);
      document.removeEventListener('visibilitychange', checkDeadline);
      window.removeEventListener('focus', checkDeadline);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, [deliver, finish]);
  useEffect(() => {
    if (!listOpen && !dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    modalRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setListOpen(false); setDialog(null); }
      if (event.key === 'Tab') {
        const items = modalRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        if (!items?.length) return;
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length-1].focus(); }
        else if (!event.shiftKey && document.activeElement === items[items.length-1]) { event.preventDefault(); items[0].focus(); }
      }
    };
    document.addEventListener('keydown', handler);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = overflow; previous?.focus(); };
  }, [listOpen, dialog]);
  const updateAnswer = (id: number, value: string) => {
    const question = questions[id - 1];
    if (question) commit(updateExamAnswer(attemptRef.current, question.id, value, Date.now()));
  };
  const markQuestion = (id: number) => {
    const question = questions[id - 1];
    if (question) commit(toggleExamMark(attemptRef.current, question.id, Date.now()));
  };
  const leave = () => {
    const currentAttempt = attemptRef.current;
    if (!canEditExam(currentAttempt, Date.now())) { finish('expired'); return; }
    commit(currentAttempt); setDialog(null); onExit();
  };
  const navigate = (id: number) => {
    setCurrent(id); setListOpen(false);
    if (mode === 'all') requestAnimationFrame(() => document.getElementById(`exam-question-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const showNotice = (text: string) => { setNotice(text); setTimeout(() => setNotice(''), 3500); };
  const printExam = () => {
    const previousMode = mode;
    setMode('all');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.print();
      setMode(previousMode);
    }));
  };
  const navigator = () => <>
    <div className="exam-panel-heading"><h2>CÂU HỎI</h2><span><strong>{completed} / {config.count}</strong> HOÀN THÀNH</span></div>
    <div className="exam-legend"><span><i className="answered"/>Đã làm</span><span><i/>Chưa làm</span><span><i className="marked"/>Đánh dấu</span><span><i className="current"/>Đang xem</span></div>
    <div className="exam-number-grid">{Array.from({length:config.count},(_,i) => i+1).map(id => <button type="button" key={id} className={`${answers[id]?.trim() ? 'answered' : ''} ${marked.includes(id) ? 'marked' : ''} ${current === id ? 'current' : ''}`} aria-label={`Câu ${id}, ${answers[id]?.trim() ? 'đã làm' : 'chưa làm'}${marked.includes(id) ? ', đã đánh dấu' : ''}`} aria-current={id===current ? 'step' : undefined} onClick={() => navigate(id)}>{id}{marked.includes(id) && <span className="question-mark"/>}</button>)}</div>
    <div className="exam-panel-footer"><span className="exam-technical-label">HOÀN THÀNH BÀI THI</span><div className="exam-final-count">{completed}<span> / {config.count}</span></div><p>{config.count - completed} câu chưa trả lời · {marked.length} câu đánh dấu</p><button className="exam-submit" onClick={() => {setListOpen(false); setDialog('submit');}}><ExamSymbol name="check"/>Nộp bài thi ngay</button><small>{saveMessage}.</small></div>
  </>;
  return <div className="exam-workspace" data-theme={dark ? 'dark' : 'light'}>
    <div className="exam-sticky">
      <header className="exam-dark-header">
        <div className="exam-theme-control"><ThemeSwitcher/></div>
        <div className="exam-editorial-title"><div className="exam-header-kicker"><span>MATH MENTOR</span><span>PHÒNG THI TRỰC TUYẾN</span></div><h1>{config.title}</h1><p>Toán 9 · {config.minutes} phút · Năm học 2026–2027</p><div className="exam-header-rail" aria-hidden="true"><span>01</span><i/><span>{String(current).padStart(2,'0')}</span><i/><span>{config.count}</span></div></div>
        <div className="exam-instrument" data-warning={seconds < 300 ? 'urgent' : seconds < 600 ? 'soon' : 'normal'}><span className="exam-technical-label">THỜI GIAN CÒN LẠI</span><div className="exam-time-digits"><span>{String(Math.floor(seconds/60)).padStart(2,'0')}</span><i>:</i><span>{String(seconds%60).padStart(2,'0')}</span></div><small>{saveMessage}</small><div className="exam-time-scale" aria-hidden="true"/></div>
        <div className="exam-header-details"><span className="exam-technical-label">GIÁO VIÊN PHỤ TRÁCH</span><strong>Nguyễn Ngọc Khoa</strong><span className="exam-live-status"><i/>Đang thi · Mã đề 102</span><button onClick={() => setDialog('exit')}>Rời phòng <ExamSymbol name="arrow"/></button></div>
      </header>
      <div className="exam-control-strip"><div className="exam-progress-text"><span className="exam-status-dot"/>Đã làm <strong>{completed} / {config.count}</strong><div className="exam-mini-progress"><span style={{width:`${completed/config.count*100}%`}}/></div></div><div className="exam-view-tabs" aria-label="Chế độ xem"><button className={mode==='all'?'active':''} onClick={() => setMode('all')}>Tất cả</button><button className={mode==='one'?'active':''} onClick={() => setMode('one')}>Từng câu</button></div><div className="exam-mobile-theme"><ThemeSwitcher/></div><div className="exam-utilities"><button onClick={async () => {try {await navigatorClipboard();showNotice('Đã sao chép liên kết Math Mentor.');}catch{showNotice('Chưa sao chép được. Em có thể sao chép địa chỉ trình duyệt.');}}}><ExamSymbol name="link"/>Sao chép link</button><button onClick={printExam}><ExamSymbol name="print"/>In đề</button><button onClick={() => setDialog('exit')}>Thoát</button><button className="exam-submit" onClick={() => setDialog('submit')}>Nộp bài <ExamSymbol name="arrow"/></button></div></div>
    </div>
    <div className="exam-main-grid"><section className="exam-questions" aria-label="Nội dung đề thi"><div className="exam-section-caption"><span>ĐỀ THI / PHẦN LÀM BÀI</span><span>{config.count} câu hỏi · {config.minutes} phút</span></div>{Array.from({length:config.count},(_,i)=>i+1).filter(id=>mode==='all'||id===current).map(id => {
      const q = questions[id - 1];
      return <article id={`exam-question-${id}`} className="exam-question-block" key={id} onFocus={() => setCurrent(id)}>
        <div className="exam-question-top"><div className="exam-question-tags"><span className="exam-question-number"><small>CÂU</small>{String(id).padStart(2,'0')}</span><span className="exam-difficulty">{id%3===0?'Vận dụng':'Thông hiểu'}</span><span className="exam-points">{(10/config.count).toFixed(2)} ĐIỂM</span></div><button className={`exam-bookmark ${marked.includes(id)?'is-marked':''}`} aria-pressed={marked.includes(id)} disabled={locked} onClick={() => markQuestion(id)}><ExamSymbol name="flag"/><span>{marked.includes(id)?'Đã đánh dấu':'Đánh dấu'}</span></button></div>
        <div className="exam-question-body"><span className="exam-type-label">{q.type==='choice'?'TRẮC NGHIỆM':q.type==='short'?'CÂU TRẢ LỜI NGẮN':'TỰ LUẬN'}</span><h2>{q.text}</h2><div className="exam-math">{q.templateId === 'power-value' ? <>5<sup>x − 1</sup> = 25</> : q.formula}</div>{q.type==='choice'?<div className="exam-choice-grid">{q.options?.map((option,i)=><button className={answers[id]===option?'selected':''} aria-pressed={answers[id]===option} disabled={locked} onClick={()=>updateAnswer(id,option)} key={option}><span>{'ABCD'[i]}</span><strong>{option}</strong>{answers[id]===option&&<ExamSymbol name="check"/>}</button>)}</div>:<label className="exam-answer-label" htmlFor={`exam-answer-${id}`}>{q.type==='short'?'CÂU TRẢ LỜI':'BÀI LÀM TỰ LUẬN'}<textarea id={`exam-answer-${id}`} rows={q.type==='short'?2:6} value={answers[id]||''} disabled={locked} onChange={e=>updateAnswer(id,e.target.value)} placeholder={q.type==='short'?'Nhập kết quả / số đo vào đây (VD: 50, 18, 1…)':'Viết các bước giải và kết luận của em tại đây…'}/></label>}</div>
        <div className="exam-question-bottom"><span className={answers[id]?.trim()?'has-answer':''}><ExamSymbol name={answers[id]?.trim()?'check':'exam'}/>{answers[id]?.trim()?'Đã nhập câu trả lời':'Chưa làm câu này'}</span>{id>1&&<button className="exam-prev-question" onClick={()=>navigate(id-1)}>← Câu trước</button>}{id<config.count&&<button onClick={()=>navigate(id+1)}>Chuyển sang Câu {id+1}<ExamSymbol name="arrow"/></button>}</div>
      </article>;
    })}<div className="exam-desktop-pagination"><button disabled={current===1} onClick={()=>navigate(current-1)}>← Câu trước</button><span>Câu {current} / {config.count}</span><button disabled={current===config.count} onClick={()=>navigate(current+1)}>Câu tiếp →</button></div><p className="exam-demo-note">Đề minh họa · Trắc nghiệm và đáp án ngắn được chấm cục bộ theo đáp án mẫu; tự luận chưa được chấm. Bài làm chưa được gửi đến giáo viên.</p></section><aside className="exam-navigator">{navigator()}</aside></div>
    <nav className="exam-mobile-controls" aria-label="Điều hướng bài thi"><button disabled={current===1} onClick={()=>navigate(current-1)}>←<span>Câu trước</span></button><button ref={listTrigger} onClick={()=>setListOpen(true)}><ExamSymbol name="list"/><span>Danh sách câu</span></button><button disabled={current===config.count} onClick={()=>navigate(current+1)}>→<span>Câu tiếp</span></button><button className="exam-submit" onClick={()=>setDialog('submit')}>Nộp bài</button></nav>
    {(listOpen||dialog)&&<div className="exam-overlay" onClick={()=>{setListOpen(false);setDialog(null);}}><div className={`exam-dialog ${listOpen?'exam-list-sheet':''}`} ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="exam-dialog-title" onClick={e=>e.stopPropagation()}><div className="exam-dialog-top"><h2 id="exam-dialog-title">{listOpen?'Danh sách câu hỏi':dialog==='submit'?'Nộp bài thi?':'Rời phòng thi?'}</h2><button aria-label="Đóng" onClick={()=>{setListOpen(false);setDialog(null);}}><ExamSymbol name="close"/></button></div>{listOpen?navigator():<><p>{dialog==='submit'?`Em đã trả lời ${completed} / ${config.count} câu hỏi.`:`${saveMessage}. Em có chắc muốn rời phòng thi? Thời gian thi vẫn tiếp tục chạy.`}</p>{dialog==='submit'&&<div className="exam-confirm-summary"><strong>{config.count-completed} câu chưa trả lời</strong><span>{marked.length} câu được đánh dấu xem lại</span></div>}<div className="exam-dialog-actions"><button className="exam-outline" onClick={()=>setDialog(null)}>Quay lại làm bài</button><button className={dialog==='submit'?'exam-submit':'exam-outline'} onClick={()=>{dialog==='submit'?finish('manual'):leave();}}>{dialog==='submit'?'Nộp bài':'Rời phòng thi'}</button></div></>}</div></div>}
    {notice&&<div className="exam-toast" role="status">{notice}</div>}
  </div>;
}
async function navigatorClipboard() { await navigator.clipboard.writeText(window.location.href); }
