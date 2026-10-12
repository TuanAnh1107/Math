import { useEffect, useRef, useState } from 'react';
import type { TutorMode } from '../../shared/ai';
import ImageComposer, { type TutorMessage } from '../ImageComposer';
import AIOrb from '../AIOrb';
import { getTutorOrbState, idleTutorActivity, type TutorActivity } from '../tutorPresence';
import useAiConversation from './useAiConversation';
import MathMarkdown from './MathMarkdown';
import 'katex/dist/katex.min.css';
import './ai-tutor.css';

export type ExternalTutorRequest = { id: number; text: string; mode: TutorMode };
const modeLabels: Record<TutorMode, string> = { tutor: 'Gia sư', hint: 'Gợi ý', solve: 'Giải chi tiết', check_answer: 'Kiểm tra lời giải', explain_concept: 'Giải thích kiến thức' };

function ImageTranscription({ entry, busy, onSend }: { entry: TutorMessage; busy: boolean; onSend: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  return <div className="inline-question-edit">
    {!confirmed ? <form onSubmit={async event => {
      event.preventDefault();
      if (!busy && text.trim() && await onSend(text.trim())) setConfirmed(true);
    }}>
      <label>Nhập hoặc sửa đề trong ảnh<textarea value={text} rows={2} maxLength={6000} disabled={busy} onChange={event => setText(event.target.value)} placeholder="Gõ lại phần đề để trợ lý kiểm tra chính xác..."/></label>
      <button type="submit" className="text-button" disabled={busy || !text.trim()}>Gửi đề đã nhập</button>
    </form> : <><p>{text}</p><button type="button" className="text-button" disabled={busy} onClick={() => setConfirmed(false)}>Chỉnh lại đề</button></>}
    <span className="signature-sr-only">Đề nhập lại cho {entry.images?.length ?? 0} ảnh</span>
  </div>;
}

export default function AiTutor({ active, message, setMessage, onSolveRequest, externalRequest }: {
  active: boolean; message: string; setMessage: (text: string) => void; onSolveRequest: () => void; externalRequest: ExternalTutorRequest | null;
}) {
  const conversation = useAiConversation();
  const [mode, setMode] = useState<TutorMode>('tutor');
  const [activity, setActivity] = useState<TutorActivity>(idleTutorActivity);
  const dock = useRef<HTMLDivElement>(null);
  const latest = useRef<HTMLDivElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const handledExternal = useRef<number | undefined>(undefined);
  const state = getTutorOrbState({ ...activity, hasError: activity.hasError || !!conversation.error }, conversation.responding, conversation.busy);
  const provider = conversation.status?.provider;
  const providerLabel = provider === 'mock' ? 'MOCK · DEMO' : provider === 'gemini' ? 'Gemini' : 'Chưa kết nối';

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || !active || conversation.busy || !externalRequest || handledExternal.current === externalRequest.id) return;
      handledExternal.current = externalRequest.id;
      void conversation.send({ text: externalRequest.text }, externalRequest.mode, 'quick');
    });
    return () => { cancelled = true; };
  }, [active, externalRequest, conversation.busy]);
  useEffect(() => {
    if (!conversation.responding) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      if (!active || document.hidden || reducedMotion.matches) conversation.finishResponding();
    };
    sync(); reducedMotion.addEventListener('change', sync); document.addEventListener('visibilitychange', sync);
    return () => { reducedMotion.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync); };
  }, [active, conversation.responding]);
  useEffect(() => {
    if (!active || !latest.current) return;
    const target = latest.current;
    if (window.matchMedia('(max-width:767px)').matches) target.scrollIntoView({ block: 'end', behavior: 'auto' });
    else transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: 'auto' });
  }, [active, conversation.turns, conversation.busy]);
  useEffect(() => {
    const app = dock.current?.closest<HTMLElement>('.app');
    const element = dock.current;
    if (!active || !app || !element) return;
    const mobile = window.matchMedia('(max-width:767px)');
    const viewport = window.visualViewport;
    const sync = () => {
      if (!mobile.matches) { app.style.removeProperty('--ai-keyboard-inset'); app.style.removeProperty('--ai-dock-height'); return; }
      const inset = Math.max(0, window.innerHeight - ((viewport?.height ?? window.innerHeight) + (viewport?.offsetTop ?? 0)));
      app.style.setProperty('--ai-keyboard-inset', `${Math.round(inset)}px`);
      app.style.setProperty('--ai-dock-height', `${Math.ceil(element.getBoundingClientRect().height)}px`);
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync);
    observer?.observe(element); sync();
    window.addEventListener('resize', sync); mobile.addEventListener('change', sync);
    viewport?.addEventListener('resize', sync); viewport?.addEventListener('scroll', sync);
    return () => {
      observer?.disconnect(); window.removeEventListener('resize', sync); mobile.removeEventListener('change', sync);
      viewport?.removeEventListener('resize', sync); viewport?.removeEventListener('scroll', sync);
      app.style.removeProperty('--ai-keyboard-inset'); app.style.removeProperty('--ai-dock-height');
    };
  }, [active]);
  const quick = (text: string, chosenMode: TutorMode) => void conversation.send({ text: message.trim() || text }, chosenMode, 'quick');
  return <>
    <div className="page-heading"><div><h1>Trợ lý Toán AI</h1><p>Gợi ý từng bước, để em tự tìm ra lời giải.</p></div><span className="badge indigo">{providerLabel}</span></div>
    <div className="ai-layout"><section className="card tutor">
      <div className="tutor-presence"><AIOrb state={state} onResponseShown={conversation.finishResponding}/><div><strong>Math Mentor</strong>
        <p role="status">{conversation.busy ? 'Đang chuẩn bị ảnh hoặc chờ phản hồi từ máy chủ…' : conversation.error ? conversation.error.message : conversation.responding ? 'Phản hồi vừa được hiển thị' : activity.readingImages ? 'Đang đọc ảnh trên thiết bị' : activity.focused ? 'Em đang soạn câu hỏi' : 'Sẵn sàng cùng em khám phá bài toán'}</p>
        <small>{provider === 'mock' ? 'Mock · không nhận diện nội dung ảnh' : provider === 'gemini' ? 'Gemini · gia sư toán học' : 'Đang kiểm tra kết nối AI'}</small></div></div>
      <div className="tutor-context"><label className="ai-mode-picker">Chế độ<select aria-label="Chế độ gia sư" value={mode} disabled={conversation.busy} onChange={event => setMode(event.target.value as TutorMode)}>{Object.entries(modeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <button type="button" className="text-button" onClick={conversation.newConversation}>Hội thoại mới</button></div>
      {(conversation.statusError || conversation.status?.configured === false) && <div className="ai-connection-notice" role="alert">
        <p>{conversation.statusError || 'Backend Gemini thiếu cấu hình. Hãy kiểm tra GEMINI_API_KEY ở environment server.'}</p><button type="button" className="text-button" onClick={() => void conversation.reloadStatus()}>Kiểm tra lại kết nối</button>
      </div>}
      <div ref={transcript} className="chat-messages" aria-label="Lịch sử hội thoại">
        {!conversation.turns.length && <div className="assistant-message"><AIOrb size="compact" animated={false} decorative/><div><small>TRỢ LÝ MATH MENTOR</small><p>Em hãy gửi đề bài, ảnh hoặc bước giải. Mình sẽ gợi ý từng bước để em tự suy nghĩ.</p></div></div>}
        {conversation.turns.map(turn => <div className="motion-message ai-turn" key={turn.id}>
          <div className="student-message image-student-message">{!!turn.entry.images?.length && <div className="sent-images">{turn.entry.images.map(image => <img src={image.src} alt={`Đề bài: ${image.name}`} key={image.id}/>)}</div>}{turn.entry.text && <p>{turn.entry.text}</p>}</div>
          {turn.response && <div className="assistant-message"><AIOrb size="compact" animated={false} decorative/><div><small>{turn.response.metadata.provider === 'mock' ? 'MOCK · KHÔNG ĐỌC NỘI DUNG ẢNH' : 'MATH MENTOR · GEMINI'}</small><MathMarkdown text={turn.response.answer}/></div></div>}
          {turn.state === 'completed' && !!turn.entry.images?.length && <ImageTranscription entry={turn.entry} busy={conversation.busy} onSend={text => conversation.send({ text }, 'tutor', 'transcription')}/>}
          {(turn.state === 'failed' || turn.state === 'aborted') && <p className="ai-turn-error">{turn.error?.message}</p>}
        </div>)}
        <div ref={latest} className="ai-latest-anchor"/>
      </div>
      <div ref={dock} className="ai-composer-dock">
        {conversation.error && <div className="ai-request-error" role="alert"><span>{conversation.error.message}</span>{conversation.error.retryable && <button type="button" className="text-button" disabled={conversation.busy} onClick={() => void conversation.retry()}>Thử gửi lại</button>}</div>}
        <div className="quick-actions"><button type="button" disabled={conversation.busy} onClick={() => quick('Cho em một gợi ý cho đề bài gần nhất.', 'hint')}>Gợi ý cho em</button><button type="button" disabled={conversation.busy} onClick={() => quick('Kiểm tra bước giải gần nhất của em.', 'check_answer')}>Kiểm tra bước này</button><button type="button" disabled={conversation.busy} onClick={() => quick('Giải thích kiến thức trong bài toán gần nhất.', 'explain_concept')}>Em chưa hiểu</button><button type="button" disabled={conversation.busy} onClick={onSolveRequest}>Xem lời giải</button></div>
        {conversation.busy && <div className="ai-request-progress" role="status"><span>Đang gửi và xử lý yêu cầu…</span><button type="button" className="text-button" onClick={conversation.abort}>Hủy yêu cầu</button></div>}
        <ImageComposer message={message} setMessage={setMessage} active={active} busy={conversation.busy} acknowledgedEntry={conversation.acknowledgedEntry} onActivityChange={setActivity} onSend={entry => conversation.send(entry, mode)}/>
        <small className="ai-disclaimer">{provider === 'mock' ? 'MOCK: câu trả lời minh họa, chưa kết nối Gemini; ảnh chỉ được kiểm tra hợp lệ.' : 'Hãy kiểm tra lại kết quả toán học. Ảnh được xử lý cho yêu cầu hiện tại, không lưu vĩnh viễn.'}</small>
      </div>
    </section><aside><section className="card ai-support"><h3>Học cách giải, không chỉ nhận đáp án.</h3><p>Trình bày suy nghĩ hoặc bước giải của em để nhận gợi ý phù hợp.</p><hr/><h4>Có đề bài trên giấy?</h4><p>Chụp ảnh rõ nét hoặc chọn ảnh JPEG, PNG, WebP. Tối đa 4 ảnh, 10 MiB mỗi ảnh; ảnh được tối ưu trước khi gửi.</p><p>Nếu đề trong ảnh chưa rõ, em có thể nhập hoặc sửa lại đề trong hội thoại.</p></section></aside></div>
  </>;
}
