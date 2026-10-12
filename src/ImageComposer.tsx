import { useEffect, useRef, useState } from 'react';
import { readImageFile, selectImageFiles, validateImageFile } from './imageAttachments';
import type { TutorActivity } from './tutorPresence';

export type AttachedImage = { id: string; src: string; name: string };
export type TutorMessage = { text: string; images?: AttachedImage[] };
type ImageDraft = Omit<AttachedImage, 'src'> & {
  src?: string;
  status: 'reading' | 'ready' | 'error';
  retryFile?: File;
  error?: string;
};
const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function Symbol({ kind }: { kind: 'send' | 'close' | 'camera' | 'image' }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'send' && <path d="m4 4 17 8-17 8 3-8-3-8ZM7 12h14"/>}
    {kind === 'close' && <path d="m6 6 12 12M6 18 18 6"/>}
    {kind === 'camera' && <><path d="M3 7h4l2-3h6l2 3h4v13H3Z"/><circle cx="12" cy="13" r="4"/></>}
    {kind === 'image' && <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></>}
  </svg>;
}
export default function ImageComposer({ message, setMessage, onSend, active = true, onActivityChange, busy = false, acknowledgedEntry }: {
  message: string; setMessage: (text: string) => void; onSend: (message: TutorMessage) => void | Promise<boolean>;
  active?: boolean; onActivityChange?: (activity: TutorActivity) => void;
  busy?: boolean; acknowledgedEntry?: TutorMessage | null;
}) {
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [sheet, setSheet] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!active) { setSheet(false); setFocused(false); }
  }, [active]);
  useEffect(() => {
    onActivityChange?.({ focused: active && focused, readingImages: images.some(image => image.status === 'reading'), hasError: !!error || images.some(image => image.status === 'error') });
  }, [active, focused, images, error, onActivityChange]);
  const imagesRef = useRef<ImageDraft[]>([]);
  const library = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const replace = useRef<string | null>(null);
  const submitting = useRef(false);
  const messageRef = useRef(message);
  messageRef.current = message;
  const updateImages = (update: (current: ImageDraft[]) => ImageDraft[]) => {
    const next = update(imagesRef.current);
    imagesRef.current = next;
    setImages(next);
  };
  const clearAcknowledged = (entry: TutorMessage) => {
    const currentImages = imagesRef.current;
    if (messageRef.current.trim() !== entry.text.trim() || currentImages.length !== (entry.images?.length ?? 0) || !currentImages.every((image, index) => image.id === entry.images?.[index].id)) return;
    updateImages(() => []); setMessage(''); setError('');
  };
  useEffect(() => { if (acknowledgedEntry) clearAcknowledged(acknowledgedEntry); }, [acknowledgedEntry]);
  useEffect(() => {
    if (!sheet) return;
    const dialog = sheetRef.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : addButton.current;
    const overflow = document.body.style.overflow;
    const siblings = Array.from(dialog.closest('.app')?.children ?? [])
      .filter((element): element is HTMLElement => element instanceof HTMLElement && !element.contains(dialog))
      .map(element => ({ element, inert: element.inert }));
    siblings.forEach(({ element }) => { element.inert = true; });
    document.body.style.overflow = 'hidden';
    dialog.querySelector<HTMLElement>(focusableSelector)?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSheet(false);
      }
      if (e.key === 'Tab') {
        const controls = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
          .filter(element => element.getClientRects().length > 0);
        if (!controls.length) {
          e.preventDefault();
          dialog.focus();
          return;
        }
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!dialog.contains(document.activeElement) || e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = overflow;
      siblings.forEach(({ element, inert }) => { element.inert = inert; });
      if (previous?.isConnected) previous.focus();
    };
  }, [sheet]);
  const choose = (capture = false) => {
    if (busy || submitting.current) return;
    setSheet(false);
    (capture ? camera : library).current?.click();
  };
  const readFile = async (file: File, id: string) => {
    const validationError = validateImageFile(file);
    if (validationError) {
      updateImages(current => current.map(image => image.id === id
        ? { ...image, status: 'error', retryFile: file, error: validationError }
        : image));
      return;
    }
    updateImages(current => current.map(image => image.id === id
      ? { ...image, status: 'reading', retryFile: file, error: undefined }
      : image));
    try {
      const src = await readImageFile(file);
      updateImages(current => current.map(image => image.id === id
        ? { id, src, name: file.name, status: 'ready' }
        : image));
    } catch {
      const readError = 'Chưa đọc được ảnh này. Em có thể thử lại hoặc xóa ảnh.';
      updateImages(current => current.map(image => image.id === id
        ? { ...image, status: 'error', retryFile: file, error: readError }
        : image));
    }
  };
  const readFiles = (files: FileList | null) => {
    if (busy || submitting.current) return;
    if (!files?.length) return;
    const target = replace.current;
    replace.current = null;
    setError('');
    const chosen = Array.from(files);
    if (target) {
      const selection = selectImageFiles(chosen, imagesRef.current.length, true);
      if (selection.notice) setError(selection.notice);
      const file = selection.selected[0];
      if (file && imagesRef.current.some(image => image.id === target)) void readFile(file, target);
      return;
    }
    const selection = selectImageFiles(chosen, imagesRef.current.length, false);
    const accepted = selection.selected;
    if (selection.notice) setError(selection.notice);
    if (!accepted.length) return;
    const drafts = accepted.map(file => ({
      id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      status: 'reading' as const,
      retryFile: file,
    }));
    updateImages(current => [...current, ...drafts]);
    drafts.forEach((draft, index) => { void readFile(accepted[index], draft.id); });
  };
  return <div className="image-composer-region" onFocusCapture={() => setFocused(true)} onBlurCapture={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
  }}>
    <form className="image-composer" onSubmit={async e => {
      e.preventDefault();
      if (busy || submitting.current) return;
      const readyImages = imagesRef.current.filter(
        (image): image is ImageDraft & { src: string } => image.status === 'ready' && !!image.src,
      );
      if ((!message.trim() && !readyImages.length) || readyImages.length !== imagesRef.current.length) return;
      const entry = { text: message.trim(), images: readyImages.map(({ id, src, name }) => ({ id, src, name })) };
      submitting.current = true;
      try {
        const accepted = await onSend(entry);
        if (accepted !== false) clearAcknowledged(entry);
      } catch { setError('Chưa gửi được câu hỏi. Nội dung đang soạn được giữ để em thử lại.'); }
      finally { submitting.current = false; }
    }}>
      {images.length > 0 && <div className="attachment-previews">{images.map(image =>
        <div className={`attachment-preview ${image.status}`} key={image.id}>
          {image.src ? <img src={image.src} alt={`Ảnh đính kèm: ${image.name}`}/> : <div className="attachment-placeholder" aria-hidden="true"><Symbol kind="image"/></div>}
          <button type="button" className="remove-attachment" disabled={busy} aria-label={`Xóa ảnh ${image.name}`} onClick={() => updateImages(current => current.filter(item => item.id !== image.id))}><Symbol kind="close"/></button>
          {image.status === 'reading' && <span className="attachment-status" role="status">Đang đọc ảnh…</span>}
          {image.status === 'error' && <span className="attachment-status" role="alert">{image.error}</span>}
          {image.status === 'error' && image.retryFile && <button type="button" className="retry-attachment" disabled={busy} onClick={() => {
            const file = image.retryFile;
            if (file) void readFile(file, image.id);
          }}>Thử lại</button>}
          <button type="button" className="replace-attachment" disabled={busy || image.status === 'reading'} onClick={() => { replace.current = image.id; if (window.matchMedia('(max-width:767px)').matches) setSheet(true); else choose(); }}>Đổi ảnh</button>
        </div>
      )}</div>}
      <div className="image-composer-row">
        <button ref={addButton} type="button" className="attach-image-button" disabled={busy} aria-label="Chụp hoặc chọn ảnh" title="Chụp hoặc chọn ảnh · JPG, PNG, WEBP" onClick={() => {
          replace.current = null;
          if (window.matchMedia('(max-width:767px)').matches) setSheet(true); else choose();
        }}><Symbol kind="camera"/></button>
        <textarea rows={1} aria-label="Câu hỏi cho trợ lý" disabled={busy} maxLength={6000} value={message} onChange={e => setMessage(e.target.value)} placeholder="Nhập câu hỏi hoặc bước giải của bạn..." onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !window.matchMedia('(max-width:767px)').matches) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }
        }}/>
        <button type="submit" className="send-image-button" aria-label="Gửi câu hỏi" disabled={busy || images.some(image => image.status !== 'ready') || !message.trim() && !images.some(image => image.status === 'ready')}><Symbol kind="send"/></button>
      </div>
      <input ref={library} type="file" disabled={busy} accept="image/jpeg,image/png,image/webp" multiple onChange={e => { void readFiles(e.target.files); e.target.value = ''; }}/>
      <input ref={camera} type="file" disabled={busy} accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e => { void readFiles(e.target.files); e.target.value = ''; }}/>
    </form>
    {error && <p className="attachment-error" role="alert">{error}</p>}
    {sheet && <div className="image-sheet-backdrop" onClick={() => setSheet(false)}>
      <div ref={sheetRef} className="image-attachment-sheet" role="dialog" aria-modal="true" aria-labelledby="image-sheet-title" tabIndex={-1} onClick={e => e.stopPropagation()}>
        <span className="sheet-handle" aria-hidden="true"/><h3 id="image-sheet-title">Thêm hình ảnh</h3>
        <button type="button" onClick={() => choose(true)}><Symbol kind="camera"/><span>{replace.current ? 'Chụp lại' : 'Chụp ảnh'}</span></button>
        <button type="button" onClick={() => choose()}><Symbol kind="image"/><span>Chọn ảnh có sẵn</span></button>
        <button type="button" className="cancel-image-sheet" onClick={() => setSheet(false)}>Hủy</button>
      </div>
    </div>}
  </div>;
}

export function ImageTutorMessage({ entry }: { entry: TutorMessage }) {
  const [question, setQuestion] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  return <>
    <div className="student-message image-student-message motion-message"><div className="sent-images">{entry.images?.map(image => <img src={image.src} alt={`Đề bài: ${image.name}`} key={image.id}/>)}</div>{entry.text && <p>{entry.text}</p>}</div>
    <div className="assistant-message motion-message"><div className="image-reading-response">
      <p>Mình đã nhận được ảnh. Hiện mình chưa đọc được nội dung ảnh tự động. Em có thể gõ phần đề cần hỏi ngay bên dưới nhé.</p>
      {!confirmed ? <form className="inline-question-edit" onSubmit={e => {e.preventDefault(); if (question.trim()) setConfirmed(true);}}>
        <label>Đề bài của em<textarea rows={3} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Nhập phần đề bài em muốn hỏi..."/></label>
        <button className="button" disabled={!question.trim()}>Tiếp tục</button>
      </form> : <><p className="confirmed-image-question">{question}</p><p>Em đã thử làm đến bước nào rồi? Em có thể gửi bước giải trong ô soạn tin.</p><button className="text-button" onClick={() => setConfirmed(false)}>Chỉnh lại đề</button></>}
    </div></div>
  </>;
}
