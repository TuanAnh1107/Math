require('./load-ts.cjs');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { canEditExam, closeExamAttempt, createExamStore, getDemoExamConfig, getExamQuestions, remainingExamSeconds, toggleExamMark, updateExamAnswer } = require('../src/examModel.ts');


function storageFixture() {
  const entries = new Map();
  return { entries, getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
}

const config = getDemoExamConfig(1, false);
const start = 1_700_000_000_000;

test('stable catalog IDs and per-exam question IDs keep the existing six demo cards', () => {
  const catalogs = [false, true].flatMap(room => [1, 2, 3].map(index => getDemoExamConfig(index, room)));
  assert.equal(new Set(catalogs.map(exam => exam.id)).size, 6);
  const questions = getExamQuestions(config);
  assert.equal(new Set(questions.map(question => question.id)).size, config.count);
  assert.notEqual(questions[0].id, questions[6].id);
  assert.equal(questions[0].templateId, questions[6].templateId);
});

test('idempotent open, remount and a new store after reload preserve deadline and answers', () => {
  const storage = storageFixture();
  const store = createExamStore(() => storage);
  const first = store.open(config, start).attempt;
  const id = getExamQuestions(config)[0].id;
  store.save(updateExamAnswer(first, id, '7', start + 1));
  const remounted = store.open(config, start + 10_000).attempt;
  assert.equal(remounted.attemptId, first.attemptId);
  assert.equal(remounted.startedAt, start);
  assert.equal(remounted.expiresAt, start + 900_000);
  assert.equal(remounted.answers[id], '7');
  assert.equal(remainingExamSeconds(remounted, start + 10_000), 890);
  const reloaded = createExamStore(() => storage).open(config, start + 20_000).attempt;
  assert.equal(reloaded.attemptId, first.attemptId);
  assert.equal(reloaded.expiresAt, first.expiresAt);
  assert.equal(reloaded.answers[id], '7');
});

test('storage-denied memory fallback survives remount and retains writes/deadline', () => {
  const store = createExamStore(() => { throw new Error('Storage denied'); });
  const opened = store.open(config, start);
  assert.equal(opened.persistence, 'memory');
  const id = getExamQuestions(config)[0].id;
  store.save(updateExamAnswer(opened.attempt, id, '7', start + 1));
  const resumed = store.open(config, start + 20_000);
  assert.equal(resumed.attempt.attemptId, opened.attempt.attemptId);
  assert.equal(resumed.attempt.expiresAt, opened.attempt.expiresAt);
  assert.equal(resumed.attempt.answers[id], '7');
  assert.equal(resumed.persistence, 'memory');
});

test('deadline guards reject edits and marks even before a timer tick; close is idempotent', () => {
  const attempt = createExamStore(() => null).open(config, start).attempt;
  const id = getExamQuestions(config)[0].id;
  assert.equal(canEditExam(attempt, attempt.expiresAt - 1), true);
  assert.equal(canEditExam(attempt, attempt.expiresAt), false);
  const expired = updateExamAnswer(attempt, id, '7', attempt.expiresAt);
  assert.equal(expired.status, 'closed');
  assert.equal(expired.answers[id], undefined);
  assert.equal(expired.result.reason, 'expired');
  assert.equal(expired.result.elapsedSeconds, 900);
  assert.equal(expired.result.submittedAt, attempt.expiresAt);
  assert.strictEqual(closeExamAttempt(expired, 'manual', attempt.expiresAt + 5000), expired);
  assert.strictEqual(updateExamAnswer(expired, id, '5', attempt.expiresAt + 1), expired);
  assert.strictEqual(toggleExamMark(expired, id, attempt.expiresAt + 1), expired);
  assert.equal(toggleExamMark(attempt, id, attempt.expiresAt).marked.length, 0);
});

test('closed attempts cannot be overwritten by stale active state and never restart', () => {
  const storage = storageFixture();
  const store = createExamStore(() => storage);
  const active = store.open(config, start).attempt;
  const closed = closeExamAttempt(active, 'manual', start + 42_000);
  store.save(closed);
  const stale = store.save(active).attempt;
  assert.equal(stale.status, 'closed');
  assert.equal(stale.result.elapsedSeconds, 42);
  const resumed = createExamStore(() => storage).open(config, start + 90_000).attempt;
  assert.equal(resumed.attemptId, closed.attemptId);
  assert.equal(resumed.status, 'closed');
  assert.equal(resumed.result.submittedAt, start + 42_000);
});

test('view result never starts an attempt, and closes an expired existing attempt deterministically', () => {
  const storage = storageFixture();
  const store = createExamStore(() => storage);
  assert.equal(store.result(config, start), null);
  assert.equal(storage.entries.size, 0);
  const attempt = store.open(config, start).attempt;
  assert.equal(store.result(config, start + 1), null);
  const result = store.result(config, attempt.expiresAt + 500_000);
  assert.equal(result.reason, 'expired');
  assert.equal(result.submittedAt, attempt.expiresAt);
  assert.equal(result.elapsedSeconds, 900);
  assert.strictEqual(store.result(config, attempt.expiresAt + 600_000), result);
});

test('only explicit objective keys score; written text and blanks are always pending', () => {
  const six = { ...config, id: 'scoring-fixture', count: 6 };
  let attempt = createExamStore(() => null).open(six, start).attempt;
  const questions = getExamQuestions(six);
  const answers = ['7', 'X ≥ 2', 'x = 3', '55°', 'x = 2 hoặc x = 3', ''];
  questions.forEach((question, index) => { attempt = updateExamAnswer(attempt, question.id, answers[index], start + 1); });
  const result = closeExamAttempt(attempt, 'manual', start + 65_999).result;
  assert.equal(result.title, six.title);
  assert.equal(result.elapsedSeconds, 65);
  assert.equal(result.correctCount, 4);
  assert.equal(result.gradedCount, 4);
  assert.equal(result.pendingCount, 2);
  assert.equal(result.answeredCount, 5);
  assert.equal(result.earnedPoints, 6.67);
  assert.equal(result.maxGradedPoints, 6.67);
  assert.equal(result.totalPoints, 10);
  assert.deepEqual(result.questionResults.slice(4).map(question => question.earnedPoints), [null, null]);
  assert.deepEqual(result.questionResults.slice(4).map(question => question.status), ['pending', 'pending']);
});

test('wrong inequalities do not pass and unanswered objective items retain their denominator', () => {
  const six = { ...config, id: 'wrong-answer-fixture', count: 6 };
  let attempt = createExamStore(() => null).open(six, start).attempt;
  const questions = getExamQuestions(six);
  attempt = updateExamAnswer(attempt, questions[1].id, 'x > 2', start + 1);
  attempt = updateExamAnswer(attempt, questions[2].id, '25', start + 1);
  const result = closeExamAttempt(attempt, 'manual', start + 1).result;
  assert.equal(result.correctCount, 0);
  assert.equal(result.gradedCount, 4);
  assert.equal(result.earnedPoints, 0);
  assert.equal(result.questionResults[0].status, 'unanswered');
  assert.equal(result.questionResults[1].status, 'incorrect');
  assert.equal(result.pendingCount, 2);
});
