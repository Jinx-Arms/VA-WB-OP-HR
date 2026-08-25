const { chromium } = require('playwright');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push((e && e.stack || String(e))));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.fill('#login-user', 's1');
  await page.fill('#login-pwd', 'vct2026');
  await page.evaluate(() => App.doLogin());
  await page.waitForTimeout(1500);

  const diag = await page.evaluate(() => ({ hasView: !!document.getElementById('view'), user: App.state && App.state.user }));
  if (!diag.hasView || !diag.user) { console.log('LOGIN_FAILED', JSON.stringify(diag)); await browser.close(); return; }

  // 强制云端模式（本地 localhost 不激活自动同步，模拟线上）
  const result = await page.evaluate(async () => {
    // 准备一份"他人数据"：staff 里加一个 jinjin 用户，模拟云端已有真实用户
    const remote = JSON.parse(JSON.stringify(App.state));
    remote.staff.push({ id:'JIN', username:'jinjin', name:'金金', role:'admin', position:'管理', status:'active', passwordHash: 'REMOTE_HASH_123', seq: remote.seq });
    remote.seq = (remote.seq || 0) + 1;

    // 监控 setState 调用（dry-run：不真写云端，避免污染生产数据）
    let setStateCalls = 0;
    CLOUD.setState = async (s) => { setStateCalls++; return { ok:true, dryRun:true }; };
    CLOUD.getState = async () => JSON.parse(JSON.stringify(remote)); // 云端始终返回"他人数据"
    CLOUD.isCloudMode = () => true;
    if(CLOUD.__testDryRun !== undefined) CLOUD.__testDryRun = true;
    App._autoSyncInterval = 50;
    App._pendingSave = null; // 本地无未保存改动

    // 记录同步前本地 staff 数量
    const before = App.state.staff.length;

    // 手动触发一次自动同步
    await App._doAutoSync();
    await new Promise(r => setTimeout(r, 200));

    const after = App.state.staff.length;
    const hasJin = App.state.staff.some(s => s.username === 'jinjin');
    return { before, after, hasJin, setStateCalls, pending: !!App._pendingSave };
  });

  console.log('SYNC_NO_PUSH_RESULT', JSON.stringify(result));

  // 判定：无 pending 时，本地应被更新为云端（含 jinjin），且 setStateCalls 应为 0（不回推覆盖）
  const ok = result.hasJin === true && result.setStateCalls === 0;
  console.log('NO_PUSH_OK', ok ? 'YES' : 'NO');

  // 场景2：本地有 pending 改动时，应推回（保留自己改动）
  const r2 = await page.evaluate(async () => {
    let setStateCalls = 0;
    CLOUD.setState = async (s) => { setStateCalls++; return { ok:true, dryRun:true }; };  // dry-run
    // 本地改一个 staff 字段（模拟用户在编辑）
    App.state.staff[0].name = 'MODIFIED_LOCAL';
    App._pendingSave = setTimeout(() => {}, 99999); // 模拟有未保存改动
    // 云端仍是含 jinjin 的 remote
    const remote = JSON.parse(JSON.stringify(App.state));
    remote.staff.push({ id:'JIN2', username:'jinjin2', name:'金金2', role:'admin', position:'管理', status:'active', passwordHash:'X', seq: 999 });
    CLOUD.getState = async () => JSON.parse(JSON.stringify(remote));

    await App._doAutoSync();
    await new Promise(r => setTimeout(r, 300));
    return { setStateCalls, hasJin2: App.state.staff.some(s => s.username === 'jinjin2'), localKept: App.state.staff[0].name };
  });
  console.log('SYNC_WITH_PUSH_RESULT', JSON.stringify(r2));
  const ok2 = r2.setStateCalls >= 1;
  console.log('WITH_PUSH_OK', ok2 ? 'YES' : 'NO');

  console.log('PAGE_ERRORS', pageErrors.length, JSON.stringify(pageErrors.slice(-3)));
  await browser.close();
})();
