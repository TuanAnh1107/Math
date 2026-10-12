require('./load-ts.cjs');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { practiceQuestions, recordPracticeResponse, summarizePractice } = require('../src/practiceSession.ts');
const { loadComponent, nodes } = require('./component-harness.cjs');

test('practice scores first checked answers and keeps initial mistakes after retry', () => {
  let responses = {};
  practiceQuestions.forEach((question, index) => {
    responses = recordPracticeResponse(responses, question, index < 2 ? question.options[0] : question.correctAnswer);
    if (index < 2) responses = recordPracticeResponse(responses, question, question.correctAnswer);
  });
  const result = summarizePractice(responses);
  assert.equal(result.firstCorrect, 8);
  assert.equal(result.corrected, 10);
  assert.equal(result.accuracy, 80);
  assert.equal(result.xp, 150);
  assert.deepEqual(result.mistakeIds, practiceQuestions.slice(0, 2).map(question => question.id));
  responses = recordPracticeResponse(responses, practiceQuestions[0], practiceQuestions[0].correctAnswer);
  assert.equal(summarizePractice(responses).xp, 150);
});

test('blank sessions have no fabricated result and question IDs are unique', () => {
  const result = summarizePractice({});
  assert.equal(result.firstCorrect, 0);
  assert.equal(result.xp, 0);
  assert.equal(result.accuracy, 0);
  assert.equal(new Set(practiceQuestions.map(question => question.id)).size, 10);
});

test('App practice handlers preserve wrong first attempt, retry, actual completion and fresh session', () => {
  const previousWindow = global.window;
  global.window = { scrollTo() {} };
  try {
    const app = loadComponent('../src/App.tsx', {
      './Theme': { useTheme: () => ({ dark: false }), default: () => null },
      './AdminMobileNav': { default: () => null },
    });
    const find = predicate => nodes(app.render()).find(predicate);
    find(node => node.props?.className?.includes('nav-item') && node.props.children?.some?.(child => child?.props?.children === 'Luyện tập')).props.onClick();
    find(node => node.props?.className === 'practice-intro').props.children.find(child => child.props?.onClick).props.onClick();
    for (let index = 0; index < 10; index++) {
      if (index === 0) {
        find(node => node.type === 'button' && node.props?.className?.startsWith('answer ')).props.onClick();
        find(node => node.props?.onClick?.name === 'checkOrContinue').props.onClick();
        find(node => node.props?.onClick?.name === 'checkOrContinue').props.onClick();
      }
      const answerButtons = nodes(app.render()).filter(node => node.type === 'button' && node.props.className?.startsWith('answer '));
      answerButtons[1].props.onClick();
      find(node => node.props?.onClick?.name === 'checkOrContinue').props.onClick();
      find(node => node.props?.onClick?.name === 'checkOrContinue').props.onClick();
    }
    const score = find(node => node.props?.className === 'big-score');
    assert.equal(score.props.children[0], 9);
    const stats = find(node => node.props?.className === 'completion-stats');
    assert.equal(stats.props.children[0].props.children[0].props.children.join(''), '90%');
    assert.equal(stats.props.children[1].props.children[0].props.children, '+150 XP');
    const restart = find(node => typeof node.props?.onClick === 'function' && node.props.children === 'Luyện tiếp');
    restart.props.onClick();
    assert.equal(find(node => node.props?.className === 'streak').props.children[0], 0);
  } finally { global.window = previousWindow; }
});

test('leaving practice and resuming retains the selected answer instead of starting a new session', () => {
  const previousWindow = global.window;
  global.window = { scrollTo() {} };
  try {
    const app = loadComponent('../src/App.tsx', { './Theme': { useTheme: () => ({ dark: false }), default: () => null }, './AdminMobileNav': { default: () => null } });
    const find = predicate => nodes(app.render()).find(predicate);
    find(node => node.type === 'button' && node.props['aria-label'] === 'Luyện tập').props.onClick();
    find(node => node.props?.className === 'practice-intro').props.children.find(child => child.props?.onClick).props.onClick();
    const choices = nodes(app.render()).filter(node => node.type === 'button' && node.props.className?.startsWith('answer '));
    choices[2].props.onClick();
    find(node => node.props?.className === 'focus-header').props.children[0].props.onClick();
    const resume = find(node => node.props?.className === 'practice-intro').props.children.find(child => child.props?.onClick);
    assert.equal(resume.props.children[0], 'Tiếp tục phiên luyện');
    resume.props.onClick();
    assert.equal(nodes(app.render()).find(node => node.type === 'button' && node.props.className?.includes('chosen')).props.children[1].props.children, 8);
  } finally { global.window = previousWindow; }
});
