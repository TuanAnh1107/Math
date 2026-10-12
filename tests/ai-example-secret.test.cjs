const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('committable server environment template stays Mock with an empty key', () => {
  const lines = fs.readFileSync(path.resolve(__dirname, '../server/.env.example'), 'utf8').split(/\r?\n/);
  const setting = lines.find(line => line.startsWith('GEMINI_API_KEY='));
  assert.equal(typeof setting, 'string');
  assert.equal(Boolean(setting.slice(setting.indexOf('=') + 1).trim()), false, 'Never put credentials in a committable template');
  assert.equal(lines.includes('AI_MODE=mock'), true);
});
