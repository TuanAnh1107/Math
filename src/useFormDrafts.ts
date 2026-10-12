import { useEffect, useRef, type RefObject } from 'react';

type DraftField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type DraftValue = { value: string; checked?: boolean };

// Retain native form drafts in memory. Passwords, files and controlled domain inputs are excluded.
export default function useFormDrafts(root: RefObject<HTMLDivElement | null>, routeKey: string, modal: string) {
  const drafts = useRef(new Map<string, DraftValue>());
  const route = useRef(routeKey);
  route.current = routeKey;
  useEffect(() => {
    const app = root.current;
    if (!app) return;
    const eligible = (element: Element): element is DraftField => {
      if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) return false;
      if (element.closest('.search-field,.function-graph,.tool-panel,.image-composer,.inline-question-edit,.exam-workspace,.table-wrap')) return false;
      if ('readOnly' in element && element.readOnly) return false;
      return !(element instanceof HTMLInputElement && ['password','file','hidden','submit','button'].includes(element.type));
    };
    const signature = (field: DraftField) => field.name || field.id || field.getAttribute('aria-label') || field.labels?.[0]?.textContent?.trim() || `${field.tagName}:${field.getAttribute('placeholder') || field.getAttribute('type') || ''}`;
    const key = (field: DraftField) => {
      const scope = field.closest('.modal') || app.querySelector('main') || app;
      const same = Array.from(scope.querySelectorAll('input,textarea,select')).filter(eligible).filter(other => signature(other) === signature(field));
      return `${route.current}:${field.closest('.modal')?.getAttribute('aria-label') || 'page'}:${signature(field)}:${same.indexOf(field)}`;
    };
    const capture = (event: Event) => {
      if (!(event.target instanceof Element) || !eligible(event.target)) return;
      const field = event.target;
      drafts.current.set(key(field), { value: field.value, ...(field instanceof HTMLInputElement && ['checkbox','radio'].includes(field.type) ? { checked: field.checked } : {}) });
    };
    const restore = () => {
      Array.from(app.querySelectorAll('input,textarea,select')).filter(eligible).forEach(field => {
        const draft = drafts.current.get(key(field));
        if (!draft) return;
        field.value = draft.value;
        if (field instanceof HTMLInputElement && draft.checked !== undefined) field.checked = draft.checked;
      });
    };
    app.addEventListener('input', capture, true); app.addEventListener('change', capture, true);
    restore();
    return () => { app.removeEventListener('input', capture, true); app.removeEventListener('change', capture, true); };
  }, [modal, root, routeKey]);
}
