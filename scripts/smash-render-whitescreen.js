/* 反复点撞图形工厂白屏 —— 模拟线上云端自动同步场景（v3）
 * 关键差异：本地 localhost 不激活自动同步，而用户线上(GitHub Pages)每30s _doAutoSync。
 * 本脚本在浏览器内 stub CLOUD 行为（isCloudMode=true, getState 返回当前 state 深拷贝），
 * 启动真实 _doAutoSync 高频运行，同时图形工厂高频编辑，复现线上 race。
 * 白屏判定：#app.sidebar 存在(侧边栏在) 且 #view 无可见内容。
 */
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

  const ops = [];
  let hit = null;

  async function checkWhite(tag) {
    const w = await page.evaluate(() => {
      const app = document.getElementById('app');
      const sb = app && app.querySelector('.sidebar');
      const view = document.getElementById('view');
      return { sideOk: !!sb, viewEmpty: !view || view.childElementCount === 0 || view.innerText.trim() === '', count: view ? view.childElementCount : -1 };
    });
    if (w.sideOk && w.viewEmpty) { hit = { tag, ...w }; ops.push('!! 白屏 @' + tag + ' count=' + w.count); }
    return w;
  }

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.fill('#login-user', 's1');
  await page.fill('#login-pwd', 'vct2026');
  await page.evaluate(() => App.doLogin());
  await page.waitForTimeout(1500);
  await page.evaluate(() => App.nav('render'));
  await page.waitForTimeout(800);
  ops.push('进入图形工厂');

  // 在浏览器内构造"线上自动同步"环境：stub CLOUD，启动真实 _doAutoSync 高频跑
  await page.evaluate(() => {
    // 保存原 getState
    window.__realGetState = CLOUD.getState;
    // stub：返回当前 state 的深拷贝（模拟云端拉到"稍旧/稍不同"的版本）
    CLOUD.getState = async function(){
      const s = JSON.parse(JSON.stringify(App.state));
      // 模拟并发：偶尔把当前编辑中的 draftSlots 丢掉（云端没有本地未保存编辑）
      if (Math.random() < 0.5 && s.render) s.render.draftSlots = null;
      return s;
    };
    CLOUD.isCloudMode = function(){ return true; };
    // 强制开启自动同步（本地原本不开启）
    App._autoSyncInterval = 30; // 30ms 高频，放大 race
    App.startAutoSync();
    window.__autoSyncForced = true;
  });
  ops.push('已强制开启云端自动同步(高频模拟)');

  // 高频图形工厂编辑 vs 自动同步 race
  for (let i = 0; i < 400 && !hit; i++) {
    try {
      await page.evaluate(() => {
        const r = Math.random();
        if (r < 0.2) App.rfToggleEdit();
        else if (r < 0.35) { if (App.can('manage')) { App.rfAddSlot(); const k=document.getElementById('ns-key'); if(k){k.value='sm'+Date.now(); App.rfAddSlotConfirm();} } }
        else if (r < 0.5) { const t=App.state.render.draftSlots; if(t){ t.size.w=(t.size.w||1080)+13; t.size.h=(t.size.h||1080)+17; } if(App.rfDraw) App.rfDraw(); }
        else if (r < 0.62) { App.rfNewTemplate(); const n=document.getElementById('nt-name'); if(n){ n.value='T'+Date.now(); App.rfNewTemplateConfirm(); } }
        else if (r < 0.74) { const t=(App.state.templates||[]); if(t[0]) App.rfSelectTemplate(t[0].id); }
        else if (r < 0.84) { App.rfUndo(); App.rfRedo(); }
        else { App.renderView(); if(App.rfDraw) App.rfDraw(); }
        // 偶尔切出再切回（模拟导航打断）
        if (Math.random() < 0.1) { App.nav('dash'); App.nav('render'); }
      });
    } catch (e) { ops.push('ACT_ERR@'+i+': ' + e.message); }
    if (i % 5 === 0) await checkWhite('i' + i);
    else if (i % 5 === 1) await checkWhite('i' + i);
    else if (i % 5 === 2) await checkWhite('i' + i);
    else if (i % 5 === 3) await checkWhite('i' + i);
    else await checkWhite('i' + i);
  }

  const out = { hit, pageErrors: pageErrors.slice(-30), consoleErrors: consoleErrors.slice(-30), logTail: ops.slice(-60) };
  fs.writeFileSync('/tmp/whitescreen-result.json', JSON.stringify(out, null, 2));
  console.log('HIT:', JSON.stringify(hit));
  console.log('PAGE_ERRORS:', pageErrors.length, 'CONSOLE_ERRORS:', consoleErrors.length);
  if (pageErrors.length) console.log('--- last pageerrors ---\n' + pageErrors.slice(-8).join('\n'));
  await browser.close();
})().catch(e => { console.error('SCRIPT_FAIL', e); process.exit(1); });
