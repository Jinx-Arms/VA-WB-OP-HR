/* 截图对比：图形工厂正常态 vs 空模板态，确认"白屏"是否实为 canvas 无内容 */
const { chromium } = require('playwright');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.fill('#login-user', 's1');
  await page.fill('#login-pwd', 'vct2026');
  await page.evaluate(() => App.doLogin());
  await page.waitForTimeout(1500);
  await page.waitForTimeout(500);
  await page.evaluate(() => App.nav('render'));
  await page.waitForTimeout(1000);
  // 诊断 #app 状态
  const diag = await page.evaluate(() => {
    const app = document.getElementById('app');
    return { hasApp: !!app, appHTMLlen: app?app.innerHTML.length:0, hasView: !!document.getElementById('view'), hasSidebar: !!(app&&app.querySelector('.sidebar')), hasLogin: !!(app&&app.querySelector('.login-wrap')), user: App.state?App.state.user:null, me: App.me()?App.me().id:null };
  });
  console.log('DIAG after nav render:', JSON.stringify(diag));

  // 1. 正常模板（选第一个有 slots 的）
  await page.evaluate(() => {
    const t = (App.state.templates||[]).find(x=>x.slots&&x.slots.length) || App.state.templates[0];
    if (t) App.rfSelectTemplate(t.id);
  });
  await page.waitForTimeout(800);
  const probeNormal = await page.evaluate(() => {
    const v = document.getElementById('view');
    const cv = document.getElementById('rf-canvas');
    return { viewCount: v.childElementCount, viewTextLen: (v.innerText||'').trim().length, canvasW: cv?cv.width:0, canvasH: cv?cv.height:0, tplName: (App.state.render.currentTemplateId||'') };
  });
  await page.screenshot({ path: '/tmp/render-normal.png' });

  // 2. 新建空模板（slots=[]）编辑态
  await page.evaluate(() => { App.rfNewTemplate(); const n=document.getElementById('nt-name'); if(n){ n.value='空模板测试'; App.rfNewTemplateConfirm(); } });
  await page.waitForTimeout(800);
  const probeEmpty = await page.evaluate(() => {
    const v = document.getElementById('view');
    const cv = document.getElementById('rf-canvas');
    return { viewCount: v.childElementCount, viewTextLen: (v.innerText||'').trim().length, canvasW: cv?cv.width:0, canvasH: cv?cv.height:0, slots: (App.state.render.draftSlots?App.state.render.draftSlots.slots.length:-1) };
  });
  await page.screenshot({ path: '/tmp/render-empty.png' });

  console.log('NORMAL:', JSON.stringify(probeNormal));
  console.log('EMPTY :', JSON.stringify(probeEmpty));
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
