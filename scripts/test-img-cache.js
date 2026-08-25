/* 验证 render-engine.js loadImage 失败后能重试 */
const { chromium } = require('playwright');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const pageErrs = [];
  page.on('pageerror', e => pageErrs.push(String(e.message)));
  await page.goto('http://localhost:3000', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.fill('#login-user','s1'); await page.fill('#login-pwd','vct2026');
  await page.evaluate(() => App.doLogin());
  await page.waitForTimeout(1500);

  const r = await page.evaluate(async () => {
    RENDER._imgCache = {};
    const badUrl = 'http://invalid.localhost/nonexistent.png';
    let firstError = null, secondError = null;
    try { await RENDER.loadImage(badUrl); }
    catch(e){ firstError = e.message; }
    try { await RENDER.loadImage(badUrl); }
    catch(e){ secondError = e.message; }
    return { firstError, secondError, cacheEntryAfterFail: RENDER._imgCache[badUrl] };
  });
  console.log('BAD_URL_TEST:', JSON.stringify(r, null, 2));

  const r2 = await page.evaluate(async () => {
    RENDER._imgCache = {};
    const goodUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    let ok = false, err = null;
    try { const r = await RENDER.loadImage(goodUrl); ok = !!r; }
    catch(e){ err = e.message; }
    return { ok, err, cached: !!RENDER._imgCache[goodUrl] };
  });
  console.log('GOOD_URL_TEST:', JSON.stringify(r2, null, 2));

  console.log('PAGE_ERRORS:', pageErrs.length);
  const ok = r.firstError && r.secondError
          && r.cacheEntryAfterFail === undefined
          && r2.ok && r2.cached;
  console.log('IMG_CACHE_FIXED:', ok ? 'YES ✅' : 'NO ❌');
  await b.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });