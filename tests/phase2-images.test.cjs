require('./load-ts.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadComponent } = require('./component-harness.cjs');
const {
  MAX_IMAGE_ATTACHMENTS,
  MAX_IMAGE_BYTES,
  readImageFile,
  selectImageFiles,
  validateImageFile,
} = require('../src/imageAttachments.ts');

function imageFile(name, size = 1, type = 'image/png') {
  return { name, size, type };
}

test('image selection reserves remaining slots and reports overflow in one batch', () => {
  const files = Array.from({ length: 4 }, (_, index) => imageFile(`image-${index}.png`));
  const selection = selectImageFiles(files, 2, false);

  assert.equal(MAX_IMAGE_ATTACHMENTS, 4);
  assert.deepEqual(selection.selected.map(file => file.name), ['image-0.png', 'image-1.png']);
  assert.equal(selection.notice, 'Em có thể gửi tối đa 4 ảnh trong một tin nhắn.');
});

test('concurrent pending drafts count toward the four-image cap; replacements use one file', () => {
  const nextBatch = selectImageFiles(
    [imageFile('third.png'), imageFile('fourth.png')],
    2,
    false,
  );
  const replacement = selectImageFiles(
    [imageFile('replacement.png'), imageFile('ignored.png')],
    4,
    true,
  );

  assert.equal(nextBatch.selected.length, 2);
  assert.equal(nextBatch.notice, '');
  assert.deepEqual(replacement.selected.map(file => file.name), ['replacement.png']);
  assert.equal(replacement.notice, 'Khi đổi ảnh, em hãy chọn từng ảnh một nhé.');
});

test('image validation accepts the 10 MiB boundary and rejects unsupported, empty, and oversized files', () => {
  assert.equal(MAX_IMAGE_BYTES, 10 * 1024 * 1024);
  assert.equal(validateImageFile(imageFile('limit.png', MAX_IMAGE_BYTES)), null);
  assert.equal(validateImageFile(imageFile('large.png', MAX_IMAGE_BYTES + 1)), 'Ảnh vượt quá 10 MiB. Em hãy chọn ảnh nhỏ hơn nhé.');
  assert.equal(validateImageFile(imageFile('empty.png', 0)), 'Ảnh này đang trống. Em hãy chọn một ảnh khác nhé.');
  assert.equal(validateImageFile(imageFile('wrong.gif', 1, 'image/gif')), 'Em hãy chọn ảnh JPG, PNG hoặc WEBP nhé.');
});

test('image reader resolves only after the browser decodes the selected file', async () => {
  const originalReader = global.FileReader;
  const originalImage = global.Image;
  try {
    global.FileReader = class {
      result = null;
      readAsDataURL() {
        this.result = 'data:image/png;base64,AA==';
        queueMicrotask(() => this.onload?.());
      }
    };
    global.Image = class {
      set src(value) {
        this.source = value;
        queueMicrotask(() => this.onload?.());
      }
    };
    assert.equal(await readImageFile(imageFile('valid.png')), 'data:image/png;base64,AA==');
  } finally {
    global.FileReader = originalReader;
    global.Image = originalImage;
  }
});

test('image reader rejects unreadable or undecodable selections for the retry UI', async () => {
  const originalReader = global.FileReader;
  const originalImage = global.Image;
  try {
    global.FileReader = class {
      readAsDataURL() {
        queueMicrotask(() => this.onerror?.());
      }
    };
    await assert.rejects(readImageFile(imageFile('unreadable.png')));

    global.FileReader = class {
      result = 'data:image/png;base64,AA==';
      readAsDataURL() {
        queueMicrotask(() => this.onload?.());
      }
    };
    global.Image = class {
      set src(value) {
        this.source = value;
        queueMicrotask(() => this.onerror?.());
      }
    };
    await assert.rejects(readImageFile(imageFile('broken.png')));
  } finally {
    global.FileReader = originalReader;
    global.Image = originalImage;
  }
});

test('image controls expose accessible names and mobile camera/library inputs', () => {
  const Composer = loadComponent('../src/ImageComposer.tsx').render;
  const html = renderToStaticMarkup(React.createElement(Composer, {
    message: '',
    setMessage() {},
    onSend() {},
  }));

  assert.match(html, /aria-label="Chụp hoặc chọn ảnh"/);
  assert.match(html, /class="attach-image-button"[^>]*>.*?d="M3 7h4l2-3h6l2 3h4v13H3Z"/s);
  assert.match(html, /aria-label="Câu hỏi cho trợ lý"/);
  assert.match(html, /aria-label="Gửi câu hỏi"/);
  assert.match(html, /accept="image\/jpeg,image\/png,image\/webp" multiple/);
  assert.match(html, /capture="environment"/);
});
