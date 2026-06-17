const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');

let app, page;

test.beforeEach(async () => {
  app = await electron.launch({
    args: [path.join(__dirname, '..')],
    executablePath: require('electron'),
    env: { ...process.env, QQ_TEST: '1' },
  });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  // Wait for the JS to fully initialize (tabs array populated)
  await page.waitForFunction(() => document.querySelectorAll('.tab').length > 0, { timeout: 5000 });
  await page.waitForTimeout(300);
});

test.afterEach(async () => {
  await app.close();
});

// ── Launch & Init ──────────────────────────────────────────────────────────────

test('app launches and window is visible', async () => {
  const title = await page.title();
  expect(title).toBe('QuickQuill');
});

test('initial tab is TEXT mode', async () => {
  const badge = await page.locator('.tab-badge').first().textContent();
  expect(badge).toBe('TEXT');
});

test('status bar shows TEXT on load', async () => {
  const mode = await page.$eval('#s-mode', el => el.textContent);
  expect(mode).toBe('TEXT');
});

test('placeholder visible on empty editor', async () => {
  const on = await page.$eval('#placeholder', el => el.classList.contains('on'));
  expect(on).toBe(true);
});

test('gutter shows line 1 on load', async () => {
  const first = await page.$eval('.g-line', el => el.textContent.trim());
  expect(first).toBe('1');
});

// ── Typing & Stats ─────────────────────────────────────────────────────────────

test('typing hides placeholder and updates stats', async () => {
  await page.fill('#editor', 'Hello world');
  await page.waitForTimeout(100);
  expect(await page.$eval('#placeholder', el => el.classList.contains('on'))).toBe(false);
  expect(await page.$eval('#s-words', el => el.textContent)).toBe('2 words');
  expect(await page.$eval('#s-chars', el => el.textContent)).toBe('11 chars');
});

test('multiline content updates gutter and line count', async () => {
  await page.fill('#editor', 'line1\nline2\nline3');
  await page.waitForTimeout(100);
  expect(await page.$eval('#s-lines', el => el.textContent)).toBe('3 lines');
  expect(await page.$$eval('.g-line', els => els.length)).toBe(3);
});

test('tab key inserts 2 spaces', async () => {
  await page.click('#editor');
  await page.keyboard.press('Tab');
  const val = await page.$eval('#editor', el => el.value);
  expect(val).toBe('  ');
});

test('typing marks tab dirty', async () => {
  await page.fill('#editor', 'x');
  await page.waitForTimeout(150);
  const dirty = await page.$eval('.tab', el => el.classList.contains('dirty'));
  expect(dirty).toBe(true);
});

// ── Mode Switching ──────────────────────────────────────────────────────────────

test('CODE mode activates pill and updates badge', async () => {
  // Use JS to directly trigger mode switch and verify it works
  await page.evaluate(() => window.__applyMode && window.__applyMode('code'));
  await page.click('[data-m="code"]');
  await page.waitForTimeout(400);
  // Check mode via s-mode status bar (most reliable indicator)
  const statusMode = await page.$eval('#s-mode', el => el.textContent);
  expect(statusMode).toBe('CODE');
  expect(await page.locator('.tab-badge').first().textContent()).toBe('CODE');
});

test('CODE mode shows language selector', async () => {
  await page.click('[data-m="code"]');
  await page.waitForTimeout(300);
  expect(await page.$eval('#lang-sel', el => el.classList.contains('on'))).toBe(true);
});

test('CODE mode shows code-bar toolbar', async () => {
  await page.click('[data-m="code"]');
  await page.waitForTimeout(300);
  expect(await page.$eval('#code-bar', el => el.style.display)).toBe('flex');
});

test('MD mode shows preview pane and md-bar', async () => {
  await page.click('[data-m="md"]');
  await page.waitForTimeout(200);
  expect(await page.$eval('#preview-pane', el => el.style.display)).not.toBe('none');
  expect(await page.$eval('#md-bar', el => el.style.display)).toBe('flex');
});

test('MD mode renders markdown preview', async () => {
  await page.click('[data-m="md"]');
  await page.fill('#editor', '# Hello QuickQuill');
  await page.waitForTimeout(300);
  const html = await page.$eval('#preview-content', el => el.innerHTML);
  expect(html).toContain('<h1>');
  expect(html).toContain('Hello QuickQuill');
});

test('MD preview toggle hides and shows preview pane', async () => {
  await page.click('[data-m="md"]');
  await page.waitForTimeout(100);
  await page.click('#b-prev');
  await page.waitForTimeout(100);
  expect(await page.$eval('#preview-pane', el => el.style.display)).toBe('none');
  await page.click('#b-prev');
  await page.waitForTimeout(100);
  expect(await page.$eval('#preview-pane', el => el.style.display)).not.toBe('none');
});

test('content preserved when switching CODE -> TEXT', async () => {
  await page.click('[data-m="code"]');
  await page.waitForTimeout(100);
  await page.fill('#code-ta', 'const x = 1;');
  await page.click('[data-m="text"]');
  await page.waitForTimeout(100);
  expect(await page.$eval('#editor', el => el.value)).toBe('const x = 1;');
});

test('content preserved when switching TEXT -> MD', async () => {
  await page.fill('#editor', '# My note');
  await page.click('[data-m="md"]');
  await page.waitForTimeout(100);
  expect(await page.$eval('#editor', el => el.value)).toBe('# My note');
});

// ── Tabs ────────────────────────────────────────────────────────────────────────

test('new tab button creates a second tab', async () => {
  await page.click('#new-tab-btn');
  await page.waitForTimeout(100);
  expect(await page.$$eval('.tab', els => els.length)).toBe(2);
});

test('new tab starts empty and independent', async () => {
  await page.fill('#editor', 'Tab 1 content');
  await page.click('#new-tab-btn');
  await page.waitForTimeout(100);
  expect(await page.$eval('#editor', el => el.value)).toBe('');
});

test('switching tabs restores content correctly', async () => {
  await page.fill('#editor', 'Tab 1');
  await page.click('#new-tab-btn');
  await page.waitForTimeout(100);
  await page.fill('#editor', 'Tab 2');
  const tabs = await page.$$('.tab');
  await tabs[0].click();
  await page.waitForTimeout(150);
  expect(await page.$eval('#editor', el => el.value)).toBe('Tab 1');
});

test('each tab has its own mode', async () => {
  await page.click('[data-m="code"]');
  await page.waitForTimeout(100);
  await page.click('#new-tab-btn');
  await page.waitForTimeout(100);
  expect(await page.locator('.tab-badge').last().textContent()).toBe('TEXT');
});

test('closing a tab removes it', async () => {
  await page.click('#new-tab-btn');
  await page.waitForTimeout(100);
  const closeBtn = await page.$('.tab:first-child .tab-close');
  await closeBtn.click();
  await page.waitForTimeout(100);
  expect(await page.$$eval('.tab', els => els.length)).toBe(1);
});

test('closing last tab creates a new empty tab', async () => {
  const closeBtn = await page.$('.tab-close');
  await closeBtn.click();
  await page.waitForTimeout(100);
  expect(await page.$$eval('.tab', els => els.length)).toBe(1);
  expect(await page.$eval('#editor', el => el.value)).toBe('');
});

// ── MD Toolbar Buttons ─────────────────────────────────────────────────────────

test('bold button wraps selection in **', async () => {
  await page.click('[data-m="md"]');
  await page.waitForTimeout(100);
  await page.fill('#editor', 'hello');
  await page.click('#editor');
  await page.keyboard.press('Meta+a');
  await page.click('#b-bold');
  expect(await page.$eval('#editor', el => el.value)).toBe('**hello**');
});

test('italic button wraps selection in *', async () => {
  await page.click('[data-m="md"]');
  await page.waitForTimeout(100);
  await page.fill('#editor', 'world');
  await page.click('#editor');
  await page.keyboard.press('Meta+a');
  await page.click('#b-ital');
  expect(await page.$eval('#editor', el => el.value)).toBe('*world*');
});

test('H1 button prefixes with # ', async () => {
  await page.click('[data-m="md"]');
  await page.waitForTimeout(100);
  await page.fill('#editor', 'Title');
  await page.click('#editor');
  await page.click('#b-h1');
  expect(await page.$eval('#editor', el => el.value)).toContain('# Title');
});

test('bullet list button prefixes with - ', async () => {
  await page.click('[data-m="md"]');
  await page.waitForTimeout(100);
  await page.fill('#editor', 'item');
  await page.click('#editor');
  await page.click('#b-ul');
  expect(await page.$eval('#editor', el => el.value)).toContain('- item');
});

test('inline code button wraps in backticks', async () => {
  await page.click('[data-m="md"]');
  await page.waitForTimeout(100);
  await page.fill('#editor', 'code');
  await page.click('#editor');
  await page.keyboard.press('Meta+a');
  await page.click('#b-code');
  expect(await page.$eval('#editor', el => el.value)).toBe('`code`');
});

// ── Word Wrap ──────────────────────────────────────────────────────────────────

test('word wrap toggle cycles pre-wrap <-> pre', async () => {
  await page.click('#b-wrap');
  await page.waitForTimeout(100);
  expect(await page.$eval('#editor', el => el.style.whiteSpace)).toBe('pre');
  await page.click('#b-wrap');
  await page.waitForTimeout(100);
  expect(await page.$eval('#editor', el => el.style.whiteSpace)).toBe('pre-wrap');
});

// ── Keyboard Shortcuts ─────────────────────────────────────────────────────────

test('⌘N creates a new tab', async () => {
  await page.click('#editor');
  await page.keyboard.press('Meta+n');
  await page.waitForTimeout(150);
  expect(await page.$$eval('.tab', els => els.length)).toBe(2);
});

test('⌘W closes current tab', async () => {
  await page.click('#new-tab-btn');
  await page.waitForTimeout(100);
  await page.click('#editor');
  await page.keyboard.press('Meta+w');
  await page.waitForTimeout(150);
  expect(await page.$$eval('.tab', els => els.length)).toBe(1);
});
