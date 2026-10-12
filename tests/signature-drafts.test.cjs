const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadComponent } = require('./component-harness.cjs');

test('native drafts survive route changes; passwords and controlled domain fields are excluded', () => {
  const names = ['Element','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement'];
  const previous = Object.fromEntries(names.map(name => [name, global[name]]));
  class Element {}
  class Input extends Element {
    constructor(name, value, type = 'text', protectedField = false) { super(); Object.assign(this, { name, value, type, protectedField, readOnly: false, tagName: 'INPUT', labels: [] }); }
    closest(selector) { return selector === '.modal' ? null : this.protectedField ? {} : null; }
    getAttribute() { return null; }
  }
  global.Element = Element; global.HTMLInputElement = Input;
  global.HTMLTextAreaElement = class extends Element {}; global.HTMLSelectElement = class extends Element {};
  let fields = [new Input('displayName', 'Original'), new Input('secret', 'initial', 'password'), new Input('search', 'initial', 'text', true)];
  const listeners = new Map();
  const scope = { querySelectorAll: () => fields };
  const app = { querySelector: () => scope, querySelectorAll: () => fields,
    addEventListener: (type, callback) => listeners.set(type, callback), removeEventListener: type => listeners.delete(type) };
  const root = { current: app };
  const harness = loadComponent('../src/useFormDrafts.ts', {}, { effects: true });
  try {
    harness.render(root, 'student:profile', ''); harness.flushEffects();
    fields[0].value = 'Alice'; fields[1].value = 'private'; fields[2].value = 'query';
    fields.forEach(field => listeners.get('input')({ target: field }));
    fields = [new Input('title', 'Untitled')];
    harness.render(root, 'admin:notification', ''); harness.flushEffects();
    assert.equal(fields[0].value, 'Untitled');
    fields[0].value = 'Lesson tomorrow'; listeners.get('input')({ target: fields[0] });
    fields = [new Input('displayName', 'Original'), new Input('secret', 'initial', 'password'), new Input('search', 'initial', 'text', true)];
    harness.render(root, 'student:profile', ''); harness.flushEffects();
    assert.equal(fields[0].value, 'Alice');
    assert.equal(fields[1].value, 'initial');
    assert.equal(fields[2].value, 'initial');
    harness.dispose(); assert.equal(listeners.size, 0);
  } finally { Object.assign(global, previous); }
});
