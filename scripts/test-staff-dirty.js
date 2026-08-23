const { chromium } = require('playwright');
const fs = require('fs');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const consoleErrors = [], pageErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => pageErrors.push((e && e.stack || String(e))));
  // 自动应答 confirm：先取消（验证拦截生效），再接受（验证能关）
  let confirmAnswer = false;
  page.on('dialog', async d => { await d.dismiss(); }); // 默认取消，验证拦截

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.fill('#login-user', 's1');
  await page.fill('#login-pwd', 'vct2026');
  await page.evaluate(() => App.doLogin());
  await page.waitForTimeout(1500);
  const diag = await page.evaluate(() => ({ hasView: !!document.getElementById('view'), user: App.state && App.state.user, serverOK: App._serverOK }));
  if (!diag.hasView || !diag.user) { console.log('LOGIN_FAILED', JSON.stringify(diag)); await browser.close(); return; }
  console.log('LOGIN_OK', JSON.stringify(diag));

  // 登录后立即同步 + 自动拉赛程不应报错（看 1.5s 内有无 pageerror）
  await page.waitForTimeout(1000);
  console.log('AFTER_LOGIN_PAGEERRORS', pageErrors.length);

  // 进人员管理页（管理员）
  await page.evaluate(() => App.nav('staff'));
  await page.waitForTimeout(600);
  // 开第一个成员的编辑弹窗
  await page.evaluate(() => { const btn = document.querySelector('[onclick^="App.staffFormOpen("]'); if (btn) btn.click(); });
  await page.waitForTimeout(400);
  const modalOpen = await page.evaluate(() => !!document.querySelector('.modal-wrap'));
  console.log('MODAL_OPEN', modalOpen);

  // 改姓名触发 dirty
  await page.evaluate(() => { const el = document.getElementById('sf-name'); if (el) { el.value = el.value + '_改'; el.dispatchEvent(new Event('input', { bubbles: true })); } });
  const dirty = await page.evaluate(() => App._modalDirty);
  console.log('DIRTY_AFTER_EDIT', dirty);

  // 点遮罩关闭（应触发 confirm 拦截，dialog handler 已 dismiss）
  await page.evaluate(() => { const w = document.querySelector('.modal-wrap'); if (w) w.click(); });
  await page.waitForTimeout(400);
  const stillOpen = await page.evaluate(() => !!document.querySelector('.modal-wrap'));
  console.log('MODAL_STILL_OPEN_AFTER_DISMISS', stillOpen, '(期望 true=拦截生效)');

  // 关闭当前弹窗，开一个新弹窗，单独测 accept 场景：用 stub 替换 confirm 返回 true
  await page.evaluate(() => { App._modalDirty = true; }); // 仍标记 dirty
  const closedAfterAccept = await page.evaluate(() => {
    const orig = window.confirm;
    window.confirm = () => true;            // stub：模拟用户点"确定关闭"
    App.closeModal();                       // 非 force，应过 confirm 并关闭
    window.confirm = orig;
    return !document.querySelector('.modal-wrap');
  });
  console.log('MODAL_CLOSED_AFTER_ACCEPT', closedAfterAccept, '(期望 true=确认后关闭)');

  console.log('CONSOLE_ERRORS', consoleErrors.length, consoleErrors.slice(-3));
  console.log('PAGE_ERRORS', pageErrors.length, pageErrors.slice(-3));
  await browser.close();
})();
