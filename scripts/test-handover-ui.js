const { chromium } = require('playwright');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const consoleErrors = [], pageErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => pageErrors.push((e && e.stack || String(e))));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // 登录（用本地 state.json 真实账号 s1）
  await page.fill('#login-user', 's1');
  await page.fill('#login-pwd', 'vct2026');
  await page.evaluate(() => App.doLogin());
  await page.waitForTimeout(1500);

  const diag = await page.evaluate(() => ({
    hasView: !!document.getElementById('view'),
    user: App.state && App.state.user,
    me: App.me && App.me() && App.me().id
  }));
  if (!diag.hasView || !diag.user) { console.log('LOGIN_FAILED', JSON.stringify(diag)); await browser.close(); return; }
  console.log('LOGIN_OK', JSON.stringify(diag));

  // 进工作交接页
  await page.evaluate(() => App.nav('handover'));
  await page.waitForTimeout(800);

  // 打开发起交接弹窗（App.handoverStart）
  await page.evaluate(() => { if (App.handoverStart) App.handoverStart(); });
  await page.waitForTimeout(600);

  // 检测弹窗内输入框尺寸是否跑偏：输入框宽度应接近 .modal-body 宽度（限宽100%）
  const ui = await page.evaluate(() => {
    const modal = document.querySelector('.modal-body');
    const note = document.getElementById('ho-note');
    const sel = document.getElementById('ho-to');
    const body = modal ? modal.getBoundingClientRect() : null;
    const r = (el) => el ? el.getBoundingClientRect() : null;
    const rn = r(note), rs = r(sel);
    return {
      hasModal: !!modal,
      bodyW: body ? Math.round(body.width) : -1,
      noteW: rn ? Math.round(rn.width) : -1,
      selW: rs ? Math.round(rs.width) : -1,
      noteInModal: !!(note && note.closest('.modal-body')),
    };
  });
  console.log('HANDOVER_UI', JSON.stringify(ui));

  // 跑偏判定：输入框宽度应 >= body宽度的 90%（限宽100%生效）
  const ratioNote = ui.bodyW > 0 ? ui.noteW / ui.bodyW : 0;
  const ratioSel = ui.bodyW > 0 ? ui.selW / ui.bodyW : 0;
  console.log('RATIO_NOTE', ratioNote.toFixed(2), 'RATIO_SEL', ratioSel.toFixed(2));
  console.log('UI_OK', (ratioNote >= 0.9 && ratioSel >= 0.9) ? 'YES' : 'NO');

  // 截图弹窗
  await page.screenshot({ path: '/tmp/handover-modal.png' }).catch(() => {});

  // 关闭弹窗，遍历其他核心页面确认渲染正常
  await page.evaluate(() => { if (App.closeModal) App.closeModal(); });
  await page.waitForTimeout(300);
  const views = ['render', 'roster', 'mine', 'schedule', 'story'];
  const viewStates = {};
  for (const v of views) {
    await page.evaluate((vv) => App.nav(vv), v);
    await page.waitForTimeout(500);
    viewStates[v] = await page.evaluate(() => {
      const view = document.getElementById('view');
      return { empty: !view || view.childElementCount === 0 || view.innerText.trim() === '', count: view ? view.childElementCount : -1 };
    });
  }
  console.log('OTHER_VIEWS', JSON.stringify(viewStates));

  // 模拟自动同步高频打断（云端路径）
  await page.evaluate(() => {
    if (CLOUD && CLOUD.getState) { CLOUD.getState = async () => JSON.parse(JSON.stringify(App.state)); CLOUD.isCloudMode = () => true; CLOUD.__testDryRun = true; App._autoSyncInterval = 40; if (App.startAutoSync) App.startAutoSync(); }
  });
  await page.evaluate(() => App.nav('handover'));
  await page.waitForTimeout(600);
  await page.evaluate(() => { if (App.handoverStart) App.handoverStart(); });
  await page.waitForTimeout(600);
  const ui2 = await page.evaluate(() => {
    const note = document.getElementById('ho-note');
    const sel = document.getElementById('ho-to');
    const modal = document.querySelector('.modal-body');
    const body = modal ? modal.getBoundingClientRect() : null;
    const r = (el) => el ? el.getBoundingClientRect() : null;
    const rn = r(note), rs = r(sel);
    return { hasModal: !!modal, bodyW: body ? Math.round(body.width) : -1, noteW: rn ? Math.round(rn.width) : -1, selW: rs ? Math.round(rs.width) : -1 };
  });
  console.log('HANDOVER_UI_AFTER_SYNC', JSON.stringify(ui2));

  console.log('PAGE_ERRORS', pageErrors.length, JSON.stringify(pageErrors.slice(-5)));
  console.log('CONSOLE_ERRORS', consoleErrors.length, JSON.stringify(consoleErrors.slice(-5)));
  await browser.close();
})();
