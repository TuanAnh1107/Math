export type ExamConfig = { id: string; title: string; count: number; minutes: number; room: boolean };
export type ExamReason = 'manual' | 'expired';
export type ExamQuestion = {
  id: string;
  number: number;
  templateId: string;
  type: 'choice' | 'short' | 'written';
  text: string;
  formula: string;
  options?: string[];
  answerKey?: string[];
  points: number;
};
export type ExamQuestionResult = {
  questionId: string;
  number: number;
  type: ExamQuestion['type'];
  answer: string;
  status: 'correct' | 'incorrect' | 'unanswered' | 'pending';
  earnedPoints: number | null;
  maxPoints: number;
};
export type ExamResult = {
  examId: string;
  attemptId: string;
  title: string;
  room: boolean;
  reason: ExamReason;
  startedAt: number;
  expiresAt: number;
  submittedAt: number;
  elapsedSeconds: number;
  totalCount: number;
  answeredCount: number;
  correctCount: number;
  gradedCount: number;
  pendingCount: number;
  earnedPoints: number;
  maxGradedPoints: number;
  totalPoints: number;
  questionResults: ExamQuestionResult[];
};
export type ExamAttempt = {
  version: 1;
  attemptId: string;
  config: ExamConfig;
  startedAt: number;
  expiresAt: number;
  status: 'active' | 'closed';
  answers: Record<string, string>;
  marked: string[];
  result: ExamResult | null;
};
export type ExamPersistence = 'session' | 'memory';
type StorageLike = { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void };
type StoredExam = { attempt: ExamAttempt; persistence: ExamPersistence };

const templates: Omit<ExamQuestion, 'id' | 'number' | 'points'>[] = [
  { templateId: 'linear-value', type: 'choice', text: 'Cho hàm số y = 2x + 3. Tính giá trị của y khi x = 2.', formula: 'y = 2x + 3', options: ['5', '7', '8', '10'], answerKey: ['7'] },
  { templateId: 'root-domain', type: 'short', text: 'Tìm điều kiện xác định của biểu thức sau.', formula: '√(x − 2)', answerKey: ['x>=2', '2<=x'] },
  { templateId: 'power-value', type: 'short', text: 'Tìm số tự nhiên x, biết:', formula: '5^(x − 1) = 25', answerKey: ['3', 'x=3'] },
  { templateId: 'triangle-angle', type: 'choice', text: 'Cho tam giác DEF vuông tại D, góc E bằng 35°. Tính số đo góc F.', formula: '∠D = 90° · ∠E = 35°', options: ['35°', '45°', '55°', '65°'], answerKey: ['55°'] },
  { templateId: 'quadratic-written', type: 'written', text: 'Giải phương trình sau. Trình bày các bước biến đổi và kết luận nghiệm.', formula: 'x² − 5x + 6 = 0' },
  { templateId: 'roots-written', type: 'written', text: 'Rút gọn biểu thức sau với x ≥ 0. Trình bày lời giải.', formula: '√(9x) + √(4x) − √x' },
];

export function getDemoExamConfig(index: number, room: boolean): ExamConfig {
  if (!Number.isInteger(index) || index < 1 || index > 3) throw new Error('Invalid demo exam index.');
  return room
    ? { id: `mock-grade10-0${index}`, title: `Thi thử vào lớp 10 · Đề số 0${index}`, count: 40, minutes: 90, room: true }
    : { id: `quiz-chapter-${index + 1}-${index === 1 ? 15 : 45}m`, title: `Kiểm tra ${index === 1 ? 15 : 45} phút · Chương ${index + 1}`, count: index === 1 ? 10 : 25, minutes: index === 1 ? 15 : 45, room: false };
}

export function getExamQuestions(config: ExamConfig): ExamQuestion[] {
  return Array.from({ length: config.count }, (_, index) => ({
    ...templates[index % templates.length],
    id: `${config.id}:q-${index + 1}`,
    number: index + 1,
    points: 10 / config.count,
  }));
}

function normalizeAnswer(answer: string) {
  return answer.trim().toLowerCase().replace(/\s+/g, '').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/−/g, '-');
}

export function canEditExam(attempt: ExamAttempt, now: number): boolean {
  return attempt.status === 'active' && now < attempt.expiresAt;
}

export function remainingExamSeconds(attempt: ExamAttempt, now: number): number {
  return attempt.status === 'closed' ? 0 : Math.max(0, Math.ceil((attempt.expiresAt - now) / 1000));
}

export function buildExamResult(attempt: ExamAttempt, reason: ExamReason, now: number): ExamResult {
  const submittedAt = reason === 'expired' ? attempt.expiresAt : Math.min(attempt.expiresAt, Math.max(attempt.startedAt, now));
  const questionResults: ExamQuestionResult[] = getExamQuestions(attempt.config).map(question => {
    const answer = attempt.answers[question.id] || '';
    // Written answers have no trustworthy local grader and must never earn a score here.
    const status = question.type === 'written' || !question.answerKey
      ? 'pending'
      : !answer.trim()
        ? 'unanswered'
        : question.answerKey.some(key => normalizeAnswer(key) === normalizeAnswer(answer)) ? 'correct' : 'incorrect';
    return { questionId: question.id, number: question.number, type: question.type, answer, status, earnedPoints: status === 'pending' ? null : status === 'correct' ? question.points : 0, maxPoints: question.points };
  });
  const gradedCount = questionResults.filter(question => question.status !== 'pending').length;
  const correctCount = questionResults.filter(question => question.status === 'correct').length;
  const points = 10 / attempt.config.count;
  return {
    examId: attempt.config.id, attemptId: attempt.attemptId, title: attempt.config.title, room: attempt.config.room, reason,
    startedAt: attempt.startedAt, expiresAt: attempt.expiresAt, submittedAt,
    elapsedSeconds: Math.max(0, Math.floor((submittedAt - attempt.startedAt) / 1000)),
    totalCount: questionResults.length,
    answeredCount: questionResults.filter(question => question.answer.trim()).length,
    correctCount, gradedCount, pendingCount: questionResults.length - gradedCount,
    earnedPoints: Number((correctCount * points).toFixed(2)),
    maxGradedPoints: Number((gradedCount * points).toFixed(2)), totalPoints: 10, questionResults,
  };
}

export function closeExamAttempt(attempt: ExamAttempt, reason: ExamReason, now: number): ExamAttempt {
  if (attempt.status === 'closed') return attempt;
  const finalReason = now >= attempt.expiresAt ? 'expired' : reason;
  return { ...attempt, status: 'closed', result: buildExamResult(attempt, finalReason, now) };
}

export function updateExamAnswer(attempt: ExamAttempt, questionId: string, value: string, now: number): ExamAttempt {
  if (!canEditExam(attempt, now)) return attempt.status === 'active' ? closeExamAttempt(attempt, 'expired', now) : attempt;
  if (!getExamQuestions(attempt.config).some(question => question.id === questionId)) return attempt;
  return { ...attempt, answers: { ...attempt.answers, [questionId]: value } };
}

export function toggleExamMark(attempt: ExamAttempt, questionId: string, now: number): ExamAttempt {
  if (!canEditExam(attempt, now)) return attempt.status === 'active' ? closeExamAttempt(attempt, 'expired', now) : attempt;
  if (!getExamQuestions(attempt.config).some(question => question.id === questionId)) return attempt;
  return { ...attempt, marked: attempt.marked.includes(questionId) ? attempt.marked.filter(id => id !== questionId) : [...attempt.marked, questionId] };
}

function validConfig(value: unknown): value is ExamConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as ExamConfig;
  return typeof config.id === 'string' && !!config.id && typeof config.title === 'string' && typeof config.room === 'boolean'
    && Number.isInteger(config.count) && config.count > 0 && config.count <= 1000 && Number.isFinite(config.minutes) && config.minutes > 0;
}

function deserializeAttempt(raw: string, examId: string): ExamAttempt | null {
  try {
    const value = JSON.parse(raw) as ExamAttempt;
    if (!value || value.version !== 1 || !validConfig(value.config) || value.config.id !== examId || typeof value.attemptId !== 'string' || !value.attemptId
      || !Number.isFinite(value.startedAt) || !Number.isFinite(value.expiresAt) || value.expiresAt <= value.startedAt
      || value.expiresAt - value.startedAt !== value.config.minutes * 60_000 || !['active', 'closed'].includes(value.status)) return null;
    const ids = new Set(getExamQuestions(value.config).map(question => question.id));
    const answers = value.answers && typeof value.answers === 'object' && !Array.isArray(value.answers)
      ? Object.fromEntries(Object.entries(value.answers).filter(([id, answer]) => ids.has(id) && typeof answer === 'string')) : {};
    const marked = Array.isArray(value.marked) ? [...new Set(value.marked.filter(id => typeof id === 'string' && ids.has(id)))] : [];
    const active: ExamAttempt = { version: 1, attemptId: value.attemptId, config: value.config, startedAt: value.startedAt, expiresAt: value.expiresAt, status: 'active', answers, marked, result: null };
    if (value.status === 'active') return active;
    if (!value.result || !['manual', 'expired'].includes(value.result.reason) || !Number.isFinite(value.result.submittedAt)) return null;
    return closeExamAttempt(active, value.result.reason, Math.min(value.expiresAt, Math.max(value.startedAt, value.result.submittedAt)));
  } catch { return null; }
}

export function createExamStore(resolveStorage: () => StorageLike | null = () => typeof window === 'undefined' ? null : window.sessionStorage) {
  // Remounts keep their deadline even when the browser denies sessionStorage.
  // This fallback cannot survive a full browser reload; UI reports that limitation explicitly.
  const memory = new Map<string, StoredExam>();
  const key = (examId: string) => `math-mentor-exam-v1:${examId}`;
  const save = (attempt: ExamAttempt): StoredExam => {
    const existing = memory.get(attempt.config.id);
    const next = existing?.attempt.attemptId === attempt.attemptId && existing.attempt.status === 'closed' ? existing.attempt : attempt;
    let persistence: ExamPersistence = 'memory';
    try {
      const storage = resolveStorage();
      if (storage) { storage.setItem(key(next.config.id), JSON.stringify(next)); persistence = 'session'; }
    } catch { /* The memory copy remains usable while this app session is open. */ }
    const stored = { attempt: next, persistence };
    memory.set(next.config.id, stored);
    return stored;
  };
  const read = (examId: string): StoredExam | null => {
    const existing = memory.get(examId);
    if (existing) return existing;
    try {
      const raw = resolveStorage()?.getItem(key(examId));
      const attempt = raw ? deserializeAttempt(raw, examId) : null;
      if (attempt) { const stored: StoredExam = { attempt, persistence: 'session' }; memory.set(examId, stored); return stored; }
    } catch { /* No persisted attempt is available in this browser. */ }
    return null;
  };
  const open = (config: ExamConfig, now: number): StoredExam => {
    if (!validConfig(config)) throw new Error('Invalid exam configuration.');
    const existing = read(config.id);
    if (existing) return existing.attempt.status === 'active' && now >= existing.attempt.expiresAt ? save(closeExamAttempt(existing.attempt, 'expired', now)) : existing;
    const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${now}-${Math.random().toString(36).slice(2)}`;
    return save({ version: 1, attemptId: `${config.id}:${random}`, config: { ...config }, startedAt: now, expiresAt: now + config.minutes * 60_000, status: 'active', answers: {}, marked: [], result: null });
  };
  const result = (config: ExamConfig, now: number): ExamResult | null => {
    const existing = read(config.id);
    if (!existing) return null;
    const attempt = existing.attempt.status === 'active' && now >= existing.attempt.expiresAt ? save(closeExamAttempt(existing.attempt, 'expired', now)).attempt : existing.attempt;
    return attempt.result;
  };
  return { open, save, read, result };
}

export const examStore = createExamStore();
export function getSavedExamResult(config: ExamConfig): ExamResult | null {
  return examStore.result(config, Date.now());
}
