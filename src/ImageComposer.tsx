import { useEffect, useRef, useState } from 'react';

export type AttachedImage = { id: string; src: string; name: string };
export type TutorMessage = { text: string; images?: AttachedImage[] };
function Symbol({ kind }: { kind: 'plus' | 'send' | 'close' | 'camera' | 'image' }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'plus' && <path d="M12 5v14M5 12h14"/>}
    {kind === 'send' && <path d="m4 4 17 8-17 8 3-8-3-8ZM7 12h14"/>}
    {kind === 'close' && <path d="m6 6 12 12M6 18 18 6"/>}
    {kind === 'camera' && <><path d="M3 7h4l2-3h6l2 3h4v13H3Z"/><circle cx="12" cy="13" r="4"/></>}
    {kind === 'image' && <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></>}
  </svg>;
}
export default function ImageComposer({ message, setMessage, onSend }: {
  message: string; setMessage: (text: string) => void; onSend: (message: TutorMessage) => void;
}) {
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [sheet, setSheet] = useState(false);
  const [error, setError] = useState('');
  const library = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const replace = useRef<string | null>(null);
  useEffect(() => {
    if (!sheet) return;
    sheetRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSheet(false); addButton.current?.focus(); }
      if (e.key === 'Tab') {
        const buttons = sheetRef.current?.querySelectorAll<HTMLButtonElement>('button');
        if (!buttons?.length) return;
        if (e.shiftKey && document.activeElement === buttons[0]) { e.preventDefault(); buttons[buttons.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === buttons[buttons.length - 1]) { e.preventDefault(); buttons[0].focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [sheet]);
  const choose = (capture = false) => {
    setSheet(false);
    (capture ? camera : library).current?.click();
  };
  const readFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const target = replace.current;
    replace.current = null;
    setError('');
    const chosen = Array.from(files);
    if (chosen.some(file => !['image/jpeg','image/png','image/webp'].includes(file.type))) {
      setError('Em hãy chọn ảnh JPG, PNG hoặc WEBP nhé.'); return;
    }
    if (chosen.some(file => file.size > 10 * 1024 * 1024)) {
      setError('Ảnh hơi lớn. Em hãy chọn ảnh dưới 10 MB nhé.'); return;
    }
    if (!target && images.length + chosen.length > 4) {
      setError('Em có thể gửi tối đa 4 ảnh trong một tin nhắn.'); return;
    }
    try {
      const next = await Promise.all(chosen.map(file => new Promise<AttachedImage>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ id: crypto.randomUUID(), src: String(reader.result), name: file.name });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      })));
      setImages(current => target ? current.map(image => image.id === target ? next[0] : image) : [...current, ...next]);
    } catch { setError('Chưa mở được ảnh. Em thử chọn lại nhé.'); }
  };
  return <div className="image-composer-region">
    <form className="image-composer" onSubmit={e => {
      e.preventDefault();
      if (!message.trim() && !images.length) return;
      onSend({ text: message.trim(), images: images.length ? images : undefined });
      setImages([]); setError('');
    }}>
      {images.length > 0 && <div className="attachment-previews">{images.map(image =>
        <div className="attachment-preview" key={image.id}>
          <img src={image.src} alt={`Ảnh đính kèm: ${image.name}`}/>
          <button type="button" className="remove-attachment" aria-label={`Xóa ảnh ${image.name}`} onClick={() => setImages(current => current.filter(item => item.id !== image.id))}><Symbol kind="close"/></button>
          <button type="button" className="replace-attachment" onClick={() => { replace.current = image.id; if (window.matchMedia('(max-width:767px)').matches) setSheet(true); else choose(); }}>Đổi ảnh</button>
        </div>
      )}</div>}
      <div className="image-composer-row">
        <button ref={addButton} type="button" className="attach-image-button" aria-label="Thêm hình ảnh" title="Chọn ảnh từ máy · JPG, PNG, WEBP" onClick={() => {
          replace.current = null;
          if (window.matchMedia('(max-width:767px)').matches) setSheet(true); else choose();
        }}><Symbol kind="plus"/></button>
        <textarea rows={1} aria-label="Câu hỏi cho trợ lý" value={message} onChange={e => setMessage(e.target.value)} placeholder="Nhập câu hỏi hoặc bước giải của bạn..." onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !window.matchMedia('(max-width:767px)').matches) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }
        }}/>
        <button type="submit" className="send-image-button" aria-label="Gửi câu hỏi" disabled={!message.trim() && !images.length}><Symbol kind="send"/></button>
      </div>
      <input ref={library} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => { void readFiles(e.target.files); e.target.value = ''; }}/>
      <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e => { void readFiles(e.target.files); e.target.value = ''; }}/>
    </form>
    {error && <p className="attachment-error" role="alert">{error}</p>}
    {sheet && <div className="image-sheet-backdrop" onClick={() => {setSheet(false); addButton.current?.focus();}}>
      <div ref={sheetRef} className="image-attachment-sheet" role="dialog" aria-modal="true" aria-labelledby="image-sheet-title" onClick={e => e.stopPropagation()}>
        <span className="sheet-handle"/><h3 id="image-sheet-title">Thêm hình ảnh</h3>
        <button type="button" onClick={() => choose(true)}><Symbol kind="camera"/><span>{replace.current ? 'Chụp lại' : 'Chụp ảnh'}</span></button>
        <button type="button" onClick={() => choose()}><Symbol kind="image"/><span>Chọn ảnh có sẵn</span></button>
        <button type="button" className="cancel-image-sheet" onClick={() => {setSheet(false); addButton.current?.focus();}}>Hủy</button>
      </div>
    </div>}
  </div>;
}

export function ImageTutorMessage({ entry }: { entry: TutorMessage }) {
  const [question, setQuestion] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  return <>
    <div className="student-message image-student-message"><div className="sent-images">{entry.images?.map(image => <img src={image.src} alt={`Đề bài: ${image.name}`} key={image.id}/>)}</div>{entry.text && <p>{entry.text}</p>}</div>
    <div className="assistant-message"><div className="image-reading-response">
      <p>Mình đã nhận được ảnh. Hiện mình chưa đọc được nội dung ảnh tự động. Em có thể gõ phần đề cần hỏi ngay bên dưới nhé.</p>
      {!confirmed ? <form className="inline-question-edit" onSubmit={e => {e.preventDefault(); if (question.trim()) setConfirmed(true);}}>
        <label>Đề bài của em<textarea rows={3} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Nhập phần đề bài em muốn hỏi..."/></label>
        <button className="button" disabled={!question.trim()}>Tiếp tục</button>
      </form> : <><p className="confirmed-image-question">{question}</p><p>Em đã thử làm đến bước nào rồi? Em có thể gửi bước giải trong ô soạn tin.</p><button className="text-button" onClick={() => setConfirmed(false)}>Chỉnh lại đề</button></>}
    </div></div>
  </>;
}
