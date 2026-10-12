const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadComponent, nodes } = require('./component-harness.cjs');

test('both tool expressions survive tab and route changes without overwriting the AI draft', () => {
  const previousWindow = global.window;
  global.window = { scrollTo() {} };
  const harness = loadComponent('../src/App.tsx', {
    './Theme': { useTheme: () => ({ dark: false }), default: () => null },
    './AdminMobileNav': { default: () => null },
  });
  const find = predicate => nodes(harness.render()).find(predicate);
  const navigate = label => find(node => node.type === 'button' && node.props['aria-label'] === label).props.onClick();
  const tab = text => find(node => node.type === 'button' && node.props.children === text).props.onClick();
  const composer = () => find(node => typeof node.props?.setMessage === 'function' && typeof node.props?.onSolveRequest === 'function');
  const expressions = () => nodes(harness.render()).filter(node => node.type === 'input' && typeof node.props?.onChange === 'function' && Object.hasOwn(node.props, 'value') && node.props.placeholder);
  try {
    navigate('Trợ lý AI');
    composer().props.setMessage('AI draft');
    navigate('Công cụ Toán'); tab('Kiểm tra biểu thức');
    expressions().find(node => node.props.placeholder === '2 × 4 + 3').props.onChange({ target: { value: '2x + 3' } });
    expressions().find(node => node.props.placeholder === 'Nhập biểu thức cần đối chiếu').props.onChange({ target: { value: '3 + 2x' } });
    tab('Bảng công thức'); tab('Kiểm tra biểu thức');
    assert.deepEqual(expressions().map(node => node.props.value), ['2x + 3', '3 + 2x']);
    navigate('Trợ lý AI');
    assert.equal(composer().props.message, 'AI draft');
    assert.equal(composer().props.active, true);
    navigate('Công cụ Toán'); tab('Kiểm tra biểu thức');
    assert.deepEqual(expressions().map(node => node.props.value), ['2x + 3', '3 + 2x']);
    assert.equal(composer().props.message, 'AI draft');
    assert.equal(composer().props.active, false);
  } finally { global.window = previousWindow; }
});
