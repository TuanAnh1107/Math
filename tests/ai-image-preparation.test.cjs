require('./load-ts.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLocalImage, prepareAiImages } = require('../src/ai/imagePreparation.ts');
const jpeg = Buffer.from([255, 216, 255, 224, 1, 2, 3, 4]);
const src = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
const image = { name: 'math.jpg', src };
function mock(t, key, value) { const old = global[key]; global[key] = value; t.after(() => { if (old === undefined) delete global[key]; else global[key] = old; }); }

test('image preparation accepts supported local bytes and rejects remote URLs, MIME mismatch, count and original byte limits', async () => {
  assert.equal(parseLocalImage(src).image.mimeType, 'image/jpeg');
  assert.equal(parseLocalImage(src).bytes.length, jpeg.length);
  assert.throws(() => parseLocalImage('https://remote.example/scan.jpg'), error => error.code === 'INVALID_IMAGE');
  assert.throws(() => parseLocalImage(src.replace('image/jpeg', 'image/png')), error => error.code === 'INVALID_IMAGE');
  assert.throws(() => parseLocalImage('data:image/svg+xml;base64,PHN2Zz4='), error => error.code === 'INVALID_IMAGE');
  await assert.rejects(prepareAiImages(Array(5).fill(image)), error => error.code === 'TOO_MANY_IMAGES');
  const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
  await assert.rejects(prepareAiImages([{ name: 'large.jpg', src: `data:image/jpeg;base64,${oversized.toString('base64')}` }]), error => error.code === 'IMAGE_TOO_LARGE');
});

test('small valid images retain exact bytes and sequential decode releases each bitmap', async t => {
  let open = 0, maxOpen = 0, closed = 0;
  mock(t, 'createImageBitmap', async () => {
    open++; maxOpen = Math.max(maxOpen, open);
    return { width: 1000, height: 750, close() { open--; closed++; } };
  });
  const result = await prepareAiImages(Array(4).fill(image));
  assert.deepEqual(result, Array(4).fill({ mimeType: 'image/jpeg', data: jpeg.toString('base64') }));
  assert.equal(maxOpen, 1);
  assert.equal(closed, 4);
  assert.equal(image.src, src, 'request preparation never changes the original preview');
});

test('large-dimension image is downscaled to a 2048px edge and compressed for request only', async t => {
  let closed = false;
  mock(t, 'createImageBitmap', async () => ({ width: 4000, height: 3000, close() { closed = true; } }));
  const drawn = [];
  const canvas = { width: 0, height: 0, getContext() { return { drawImage(...args) { drawn.push(args); } }; },
    toBlob(callback, mime, quality) { assert.equal(mime, 'image/webp'); assert.equal(quality <= .9, true); callback(new Blob(['small'], { type: mime })); } };
  mock(t, 'document', { createElement(tag) { assert.equal(tag, 'canvas'); return canvas; } });
  const result = await prepareAiImages([image]);
  assert.equal(result[0].mimeType, 'image/webp');
  assert.deepEqual(drawn[0].slice(1), [0, 0, 2048, 1536]);
  assert.equal(canvas.width, 0, 'canvas backing memory is released');
  assert.equal(closed, true);
});

test('image decode and pixel-limit failures are explicit; abort closes any decoded bitmap', async t => {
  let closed = 0;
  mock(t, 'createImageBitmap', async () => ({ width: 10000, height: 5000, close() { closed++; } }));
  await assert.rejects(prepareAiImages([image]), error => error.code === 'IMAGE_DIMENSIONS_TOO_LARGE');
  assert.equal(closed, 1);
  global.createImageBitmap = async () => { throw new Error('decoder details'); };
  await assert.rejects(prepareAiImages([image]), error => error.code === 'INVALID_IMAGE' && !error.message.includes('decoder details'));
  const controller = new AbortController();
  global.createImageBitmap = async () => { controller.abort(); return { width: 100, height: 100, close() { closed++; } }; };
  await assert.rejects(prepareAiImages([image], controller.signal), error => error.code === 'ABORTED');
  assert.equal(closed, 2);
});

test('oversized encoded PNG dimensions are rejected before creating a decoder bitmap', async t => {
  const png = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.writeUInt32BE(10000, 16); png.writeUInt32BE(5000, 20);
  let decodes = 0;
  mock(t, 'createImageBitmap', async () => { decodes++; throw new Error('must not decode'); });
  await assert.rejects(prepareAiImages([{ name: 'oversized.png', src: `data:image/png;base64,${png.toString('base64')}` }]), error => error.code === 'IMAGE_DIMENSIONS_TOO_LARGE');
  assert.equal(decodes, 0);
});

test('aborting an in-flight bitmap decode resolves promptly and closes its eventual bitmap', async t => {
  let finish, closed = 0;
  mock(t, 'createImageBitmap', () => new Promise(resolve => { finish = resolve; }));
  const controller = new AbortController();
  const pending = prepareAiImages([image], controller.signal);
  await Promise.resolve();
  controller.abort();
  await assert.rejects(pending, error => error.code === 'ABORTED');
  finish({ width: 100, height: 100, close() { closed++; } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(closed, 1);
});
