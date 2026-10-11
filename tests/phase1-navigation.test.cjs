require('./load-ts.cjs');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadComponent, nodes } = require('./component-harness.cjs');

const pages = ['Tổng quan', 'Chương trình', 'Bài học', 'Câu hỏi', 'Đề kiểm tra',
  'Phòng thi', 'Học sinh', 'Nhóm học sinh', 'Kết quả', 'Thông báo', 'Cài đặt'];

function loadOpenNavigation() {
  const filename = path.resolve(__dirname, '../src/AdminMobileNav.tsx');
  const module = new Module(filename, moduleParent);
  module.filename = filename;
  module.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = module.require.bind(module);
  module.require = name => {
    if (name.endsWith('.css')) return {};
    if (name === 'react') return {
      ...React,
      useState: () => [true, () => {}],
      useEffect: () => {},
      useId: () => 'admin-navigation-test',
      useRef: () => ({ current: null }),
    };
    return originalRequire(name);
  };
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: filename,
  }).outputText, filename);
  return module.exports.default;
}
const moduleParent = module;
const Navigation = loadOpenNavigation();

function descendants(element) {
  if (!element || typeof element !== 'object') return [];
  return [element, ...React.Children.toArray(element.props?.children).flatMap(descendants)];
}
const props = { items: pages.map(label => ({ label, icon: null })), page: 'Phòng thi',
  onNavigate: () => {}, onStudent: () => {} };

test('F06: the mobile admin menu exposes all 11 pages, themes and the student interface', () => {
  const html = renderToStaticMarkup(React.createElement(Navigation, props));
  for (const page of pages) assert.ok(html.includes(page), `Missing admin page: ${page}`);
  for (const label of ['Sáng', 'Tối', 'Theo hệ thống', 'Giao diện học sinh']) {
    assert.ok(html.includes(label), `Missing menu action: ${label}`);
  }
  assert.ok(html.includes('aria-label="Điều hướng quản trị"'));
  assert.ok(html.includes('role="dialog"'));
  assert.ok(html.includes('aria-modal="true"'));
});

test('F06: each admin page button calls navigation with its own label', () => {
  const calls = [];
  const tree = Navigation({ ...props, onNavigate: page => calls.push(page) });
  const buttons = descendants(tree).filter(node => node.type === 'button' && node.props.className === 'settings-row');
  for (const page of pages) {
    const button = buttons.find(node => node.props.children[0].props.children === page);
    assert.ok(button, `Missing clickable page: ${page}`);
    button.props.onClick();
  }
  assert.deepEqual(calls, pages);
});

test('F06: returning to student mode invokes the parent role switch', () => {
  let switched = 0;
  const tree = Navigation({ ...props, onStudent: () => switched++ });
  const button = descendants(tree).find(node => node.type === 'button'
    && node.props.children?.[0]?.props?.children === 'Giao diện học sinh');
  assert.ok(button);
  button.props.onClick();
  assert.equal(switched, 1);
});

test('F06: App connects the mobile role switch to the real student home route', () => {
  function AdminNavigationMarker() { return null; }
  const app = loadComponent('../src/App.tsx', {
    './Theme': { __esModule: true, default: () => null, useTheme: () => ({ dark: false }) },
    './AdminMobileNav': { __esModule: true, default: AdminNavigationMarker },
  });
  const previousWindow = global.window;
  global.window = { scrollTo() {} };
  try {
    const switchButton = nodes(app.render()).find(node => node.props.className === 'mode-switch');
    switchButton.props.onClick();
    const navigation = nodes(app.render()).find(node => node.type === AdminNavigationMarker);
    assert.ok(navigation);
    assert.deepEqual(navigation.props.items.map(item => item.label), pages);
    navigation.props.onStudent();
    const studentTree = app.render();
    assert.equal(app.cells[0], 'Trang chủ');
    assert.equal(app.cells[1], false);
    assert.ok(nodes(studentTree).some(node => node.props['aria-label'] === 'Điều hướng chính'));
  } finally { global.window = previousWindow; }
});
