require('./load-ts.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canEditExam,
  closeExamAttempt,
  createExamStore,
  getDemoExamConfig,
  getExamQuestions,
  remainingExamSeconds,
  updateExamAnswer,
} = require('../src/examModel.ts');
const {
  practiceQuestions,
  recordPracticeResponse,
  summarizePractice,
} = require('../src/practiceSession.ts');

function createStorage() {
  const entries = new Map();
  return {
    entries,
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
}

const exam = getDemoExamConfig(1, false);
const startedAt = 1_700_000_000_000;

test('F01: reaching the deadline closes the attempt and rejects further edits', () => {
  const attempt = createExamStore(() => null).open(exam, startedAt).attempt;
  const questionId = getExamQuestions(exam)[0].id;
  const expired = updateExamAnswer(attempt, questionId, '7', attempt.expiresAt);

  assert.equal(canEditExam(attempt, attempt.expiresAt), false);
  assert.equal(expired.status, 'closed');
  assert.equal(expired.result.reason, 'expired');
  assert.equal(expired.answers[questionId], undefined);
  assert.equal(remainingExamSeconds(expired, attempt.expiresAt), 0);
  assert.strictEqual(
    updateExamAnswer(expired, questionId, '7', attempt.expiresAt + 1),
    expired,
  );
  assert.strictEqual(closeExamAttempt(expired, 'manual', attempt.expiresAt + 1), expired);
});

test('F02: reopening a room reuses the stored attempt and absolute deadline', () => {
  const storage = createStorage();
  const firstStore = createExamStore(() => storage);
  const attempt = firstStore.open(exam, startedAt).attempt;
  const questionId = getExamQuestions(exam)[0].id;
  firstStore.save(updateExamAnswer(attempt, questionId, '7', startedAt + 1));

  const resumed = createExamStore(() => storage).open(exam, startedAt + 20_000).attempt;
  assert.equal(resumed.attemptId, attempt.attemptId);
  assert.equal(resumed.startedAt, startedAt);
  assert.equal(resumed.expiresAt, startedAt + exam.minutes * 60_000);
  assert.equal(resumed.answers[questionId], '7');
  assert.equal(remainingExamSeconds(resumed, startedAt + 20_000), exam.minutes * 60 - 20);
});

test('F02: memory fallback retains the attempt across component remounts', () => {
  const store = createExamStore(() => { throw new Error('Storage denied'); });
  const opened = store.open(exam, startedAt);
  const questionId = getExamQuestions(exam)[0].id;
  store.save(updateExamAnswer(opened.attempt, questionId, '7', startedAt + 1));

  const resumed = store.open(exam, startedAt + 20_000);
  assert.equal(resumed.persistence, 'memory');
  assert.equal(resumed.attempt.attemptId, opened.attempt.attemptId);
  assert.equal(resumed.attempt.expiresAt, opened.attempt.expiresAt);
  assert.equal(resumed.attempt.answers[questionId], '7');
});

test('F03: objective exam results are calculated from the submitted answers', () => {
  const attempt = createExamStore(() => null).open(exam, startedAt).attempt;
  const questions = getExamQuestions(exam);
  const answered = updateExamAnswer(attempt, questions[0].id, '7', startedAt + 1);
  const submitted = closeExamAttempt(answered, 'manual', startedAt + 60_000);

  assert.equal(submitted.result.title, exam.title);
  assert.equal(submitted.result.correctCount, 1);
  assert.equal(submitted.result.answeredCount, 1);
  assert.equal(submitted.result.earnedPoints, 1);
  assert.equal(submitted.result.maxGradedPoints, 8);
  assert.equal(submitted.result.questionResults[0].status, 'correct');
  assert.equal(submitted.result.questionResults[1].status, 'unanswered');
});

test('F03: practice summary reflects recorded first and corrected answers', () => {
  const question = practiceQuestions[0];
  const firstResponse = recordPracticeResponse({}, question, question.options[0]);
  const correctedResponse = recordPracticeResponse(firstResponse, question, question.correctAnswer);
  const summary = summarizePractice(correctedResponse);

  assert.equal(summary.checked, 1);
  assert.equal(summary.firstCorrect, 0);
  assert.equal(summary.corrected, 1);
  assert.equal(summary.accuracy, 0);
  assert.deepEqual(summary.mistakeIds, [question.id]);
  assert.equal(summary.xp, 15);
});
