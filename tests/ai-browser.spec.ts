import { expect, test } from '@playwright/test';

test('blocked Origin and unavailable backend display distinct safe errors, retain draft, and recover without duplicate messages', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Trợ lý AI', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const draft = page.getByRole('textbox', { name: 'Câu hỏi cho trợ lý', exact: true });
  const send = page.getByRole('button', { name: 'Gửi câu hỏi', exact: true });
  await draft.fill('5 + 5 bằng bao nhiêu?');
  await page.route('**/api/ai/chat', async route => {
    // Chromium owns the Origin header; send the negative test via the HTTP context
    // and return the real Express rejection to the browser, without faking success.
    const response = await route.fetch({ headers: { ...route.request().headers(), origin: 'https://blocked.example' } });
    await route.fulfill({ response });
  });
  const blocked = page.waitForResponse(response => response.url().endsWith('/api/ai/chat'));
  await send.click(); const denied = await blocked;
  expect(denied.status()).toBe(403); expect((await denied.json()).error.code).toBe('ORIGIN_NOT_ALLOWED');
  await expect(page.locator('.ai-request-error')).toContainText('chưa được máy chủ cho phép');
  await expect(draft).toHaveValue('5 + 5 bằng bao nhiêu?'); await expect(send).toBeEnabled();
  await expect(page.locator('.ai-orb-presence')).toHaveAttribute('data-state', 'error');
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.unroute('**/api/ai/chat');
  await page.route('**/api/ai/chat', route => route.fulfill({ status: 500, body: '' }));
  await send.click(); await expect(page.locator('.ai-request-error')).toContainText('Chưa kết nối được máy chủ trợ lý');
  await expect(draft).toHaveValue('5 + 5 bằng bao nhiêu?');
  await page.unroute('**/api/ai/chat');
  await page.getByRole('button', { name: 'Thử gửi lại', exact: true }).click();
  await expect(page.locator('.ai-turn .assistant-message')).toHaveCount(1);
  await expect(draft).toHaveValue(''); await expect(page.locator('.ai-request-progress')).toHaveCount(0);
});

test('live local Mock Tutor: modes, context, image, failure/retry, abort, navigation, themes and viewport boundaries', async ({ page }, info) => {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  // Reproduce browsers where randomUUID is absent while secure random bytes still work.
  await page.addInitScript(() => Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Trợ lý AI', exact: true }).click();
  await expect(page.locator('.page-heading .badge')).toHaveText('MOCK · DEMO');
  const draft = page.getByRole('textbox', { name: 'Câu hỏi cho trợ lý', exact: true });
  const send = page.getByRole('button', { name: 'Gửi câu hỏi', exact: true });
  const replies = page.locator('.chat-messages .ai-turn .assistant-message');
  const submit = async (text: string, mode: string, previous: number) => {
    await page.getByRole('combobox', { name: 'Chế độ gia sư' }).selectOption(mode);
    await draft.fill(text);
    const response = page.waitForResponse(r => r.url().endsWith('/api/ai/chat') && r.request().method() === 'POST');
    await send.click();
    const result = await response; expect(result.status()).toBe(200);
    expect((await result.json()).mode).toBe(mode);
    await expect(replies).toHaveCount(previous + 1);
    await expect(draft).toHaveValue('');
  };
  let count = 0;
  for (const mode of ['tutor', 'hint', 'solve', 'check_answer', 'explain_concept']) {
    await submit('Giải thích phương trình 2x + 1 = 7', mode, count++);
  }
  await expect(replies.last()).toContainText('DEMO');
  await expect(page.locator('.math-markdown .katex').first()).toBeAttached();

  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 80;
    const context = canvas.getContext('2d')!; context.fillStyle = 'white'; context.fillRect(0, 0, 240, 80);
    context.fillStyle = 'black'; context.font = '24px sans-serif'; context.fillText('2x + 1 = 7', 20, 45);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('.image-composer input[multiple]').setInputFiles({ name: 'question.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
  await expect(page.locator('.attachment-preview.ready')).toHaveCount(1);
  await submit('Hỏi về ảnh đề toán', 'tutor', count++);
  await expect(replies.last()).toContainText('Mock chưa nhận diện');
  await expect(page.locator('.attachment-preview')).toHaveCount(0);
  await expect(page.locator('.sent-images img')).toHaveCount(1);

  await draft.fill('[mock:error]');
  let result = page.waitForResponse(r => r.url().endsWith('/api/ai/chat'));
  await send.click(); expect((await result).status()).toBe(503);
  await expect(draft).toHaveValue('[mock:error]');
  await expect(page.locator('.ai-orb-presence')).toHaveAttribute('data-state', 'error');
  result = page.waitForResponse(r => r.url().endsWith('/api/ai/chat'));
  await page.getByRole('button', { name: 'Thử gửi lại', exact: true }).click(); expect((await result).status()).toBe(200);
  await expect(replies).toHaveCount(++count); await expect(draft).toHaveValue('');

  await draft.fill('[mock:timeout]'); await send.click();
  await expect(page.locator('.ai-orb-presence')).toHaveAttribute('data-state', 'processing');
  await page.getByRole('button', { name: 'Hủy yêu cầu', exact: true }).click();
  await expect(draft).toHaveValue('[mock:timeout]'); await expect(send).toBeEnabled();
  await page.getByRole('button', { name: 'Hội thoại mới', exact: true }).click();
  await expect(page.locator('.chat-messages .ai-turn')).toHaveCount(0);
  await expect(draft).toHaveValue('[mock:timeout]');
  await draft.fill('Draft preserved across navigation');
  await page.getByRole('button', { name: 'Tiến độ', exact: true }).first().click();
  await page.getByRole('button', { name: 'Trợ lý AI', exact: true }).click();
  await expect(draft).toHaveValue('Draft preserved across navigation');
  await submit('Câu hỏi sau hội thoại mới', 'hint', 0);

  // System mode lets viewport QA cover both palettes without changing existing theme controls.
  for (const width of [1440, 1024, 768, 390, 360, 320]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await expect(page.locator('.app')).toHaveAttribute('data-theme', colorScheme);
      await expect(draft).toBeVisible(); await expect(send).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      if (width < 768) {
        const dock = await page.locator('.ai-composer-dock').boundingBox();
        const nav = await page.locator('.mobile-nav').boundingBox();
        expect(dock).not.toBeNull(); expect(nav).not.toBeNull();
        expect(dock!.y + dock!.height).toBeLessThanOrEqual(nav!.y + 1);
      }
      await page.screenshot({ path: info.outputPath(`ai-${width}-${colorScheme}.png`), fullPage: true });
    }
  }
  await page.getByRole('button', { name: 'Chụp hoặc chọn ảnh', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Thêm hình ảnh' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chụp ảnh', exact: true })).toBeVisible();
  await expect(page.locator('.image-composer input[capture]')).toHaveAttribute('capture', 'environment');
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog', { name: 'Thêm hình ảnh' })).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await draft.fill('Gợi ý tiếp theo'); const after = page.waitForResponse(r => r.url().endsWith('/api/ai/chat'));
  await send.click(); expect((await after).status()).toBe(200);
  await expect(page.locator('.ai-orb-presence')).toHaveAttribute('data-state', 'idle');
  await expect.poll(async () => {
    const answer = await replies.last().boundingBox();
    const composer = await page.locator('.ai-composer-dock').boundingBox();
    return !!answer && !!composer && answer.y + answer.height <= composer.y + 1;
  }).toBe(true);
  await page.screenshot({ path: info.outputPath('ai-320-dark-latest-viewport.png') });
  expect(failures).toEqual([]);
});
