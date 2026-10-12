import { useEffect, useRef, useState } from 'react';
import { AI_LIMITS, historyUserText, trimAIHistory, type AIChatRequest, type AIChatResponse, type AIStatus, type TutorMode } from '../../shared/ai';
import type { TutorMessage } from '../ImageComposer';
import { AiClientError, getAiStatus, sendAiMessage } from './aiClient';
import { prepareAiImages } from './imagePreparation';
import createClientMessageId from './clientMessageId';

type Origin = 'composer' | 'quick' | 'transcription';
export type AiTurn = {
  id: string;
  entry: TutorMessage;
  mode: TutorMode;
  origin: Origin;
  state: 'preparing' | 'sending' | 'completed' | 'failed' | 'aborted';
  request?: AIChatRequest;
  response?: AIChatResponse;
  error?: AiClientError;
};

export default function useAiConversation() {
  const [turns, setTurns] = useState<AiTurn[]>([]);
  const turnsRef = useRef<AiTurn[]>([]);
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [busy, setBusy] = useState(false);
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState<AiClientError | null>(null);
  const [acknowledgedEntry, setAcknowledgedEntry] = useState<TutorMessage | null>(null);
  const conversationId = useRef<string | undefined>(undefined);
  const generation = useRef(0);
  const pending = useRef<{ controller: AbortController; id: string; token: number } | null>(null);
  const unsent = useRef<{ entry: TutorMessage; mode: TutorMode; origin: Origin } | null>(null);
  const mounted = useRef(true);
  const commit = (next: AiTurn[]) => {
    const retained = new Set([...next.filter(turn => turn.state === 'completed').slice(-10), ...next.filter(turn => turn.state !== 'completed').slice(-1)]);
    turnsRef.current = next.filter(turn => retained.has(turn)); setTurns(turnsRef.current);
  };
  const replace = (id: string, change: Partial<AiTurn>) => commit(turnsRef.current.map(turn => turn.id === id ? { ...turn, ...change } : turn));
  const reloadStatus = async (signal?: AbortSignal) => {
    try {
      const result = await getAiStatus({ signal });
      if (!mounted.current || signal?.aborted) return;
      setStatus(result); setStatusError('');
    } catch {
      if (!mounted.current || signal?.aborted) return;
      setStatusError('Chưa kết nối được backend AI. Hãy kiểm tra máy chủ và thử lại.');
    }
  };
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void reloadStatus(controller.signal);
    return () => {
      mounted.current = false; generation.current++;
      controller.abort(); pending.current?.controller.abort(); pending.current = null;
    };
  }, []);

  const run = async (turn: AiTurn): Promise<boolean> => {
    if (pending.current) return false;
    const controller = new AbortController();
    const token = ++generation.current;
    pending.current = { controller, id: turn.id, token };
    setBusy(true); setResponding(false); setError(null);
    replace(turn.id, { state: 'preparing', error: undefined });
    const current = () => mounted.current && generation.current === token && !controller.signal.aborted;
    try {
      const request = turn.request ?? {
        message: turn.entry.text.trim(), clientMessageId: turn.id,
        ...(conversationId.current ? { conversationId: conversationId.current } : {}),
        history: trimAIHistory(turnsRef.current.filter(item => item.state === 'completed' && item.response).flatMap(item => [
          { role: 'user' as const, text: historyUserText(item.entry.text, item.entry.images?.length ?? 0) },
          { role: 'model' as const, text: item.response!.answer },
        ])),
        images: await prepareAiImages(turn.entry.images ?? [], controller.signal),
        mode: turn.mode,
      };
      if (!current()) return false;
      replace(turn.id, { request, state: 'sending' });
      const response = await sendAiMessage(request, { signal: controller.signal, timeoutMs: (status?.timeoutMs ?? 30_000) + 5_000 });
      if (!current()) return false;
      conversationId.current = response.conversationId;
      setStatus(previous => previous ? { ...previous, configured: true, provider: response.metadata.provider } : previous);
      // Retain normalized images in the transcript, not all full-size original files.
      const images = request.images.map((image, index) => ({ ...turn.entry.images![index], src: `data:${image.mimeType};base64,${image.data}` }));
      replace(turn.id, { state: 'completed', response, error: undefined, entry: { ...turn.entry, images }, request: undefined });
      if (turn.origin === 'composer') setAcknowledgedEntry(turn.entry);
      setResponding(true);
      return true;
    } catch (failure) {
      if (generation.current !== token || !mounted.current) return false;
      const problem = failure instanceof AiClientError ? failure : new AiClientError('CLIENT_ERROR', 'Chưa gửi được câu hỏi. Em có thể thử lại.', true);
      replace(turn.id, { state: controller.signal.aborted ? 'aborted' : 'failed', error: problem });
      setError(problem);
      return false;
    } finally {
      if (pending.current?.token === token) { pending.current = null; if (mounted.current) setBusy(false); }
    }
  };
  const send = async (entry: TutorMessage, mode: TutorMode, origin: Origin = 'composer') => {
    if (pending.current) return false;
    unsent.current = null;
    if (!entry.text.trim() && !entry.images?.length) return false;
    if (entry.text.length > AI_LIMITS.maxMessageChars) {
      setError(new AiClientError('VALIDATION_ERROR', `Câu hỏi tối đa ${AI_LIMITS.maxMessageChars} ký tự.`)); return false;
    }
    try {
      const turn: AiTurn = { id: createClientMessageId(), entry: { text: entry.text, images: entry.images?.map(image => ({ ...image })) }, mode, origin, state: 'preparing' };
      commit([...turnsRef.current, turn]);
      return await run(turn);
    } catch (failure) {
      unsent.current = { entry, mode, origin };
      setError(failure instanceof AiClientError ? failure : new AiClientError('CLIENT_ERROR', 'Chưa chuẩn bị được yêu cầu. Nội dung đang soạn được giữ; hãy tải lại trang rồi thử lại.', true));
      return false;
    }
  };
  const retry = async () => {
    if (unsent.current) return send(unsent.current.entry, unsent.current.mode, unsent.current.origin);
    const turn = [...turnsRef.current].reverse().find(item => item.state === 'failed' || item.state === 'aborted');
    return turn ? run(turn) : false;
  };
  const abort = () => {
    const operation = pending.current;
    if (!operation) return;
    generation.current++; operation.controller.abort(); pending.current = null;
    const problem = new AiClientError('ABORTED', 'Đã hủy yêu cầu. Nội dung đang soạn vẫn được giữ.', true);
    replace(operation.id, { state: 'aborted', error: problem });
    setBusy(false); setResponding(false); setError(problem);
  };
  const newConversation = () => {
    generation.current++; pending.current?.controller.abort(); pending.current = null;
    conversationId.current = undefined; unsent.current = null; commit([]);
    setBusy(false); setResponding(false); setError(null); setAcknowledgedEntry(null);
  };
  return { turns, status, statusError, busy, responding, error, acknowledgedEntry, send, retry, abort, newConversation, reloadStatus,
    finishResponding: () => setResponding(false) };
}
