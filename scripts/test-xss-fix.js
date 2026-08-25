/* 验证 XSS 修复：注入恶意字符串，DOM 中不应出现 onerror / script 标签 */
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

  // 注入恶意数据到 state 多处字段
  await page.evaluate(() => {
    const payload = {
      title: '<img src=x onerror="window.__pwn=1">',
      note: '<script>window.__pwn2=1</script>',
      reason: '"><img src=x onerror="window.__pwn3=1">',
      name: '<b onmouseover="window.__pwn4=1">bad</b>',
      position: '<script>window.__pwn5=1</script>'
    };
    App.state.content.push({
      id: App.uid('C'),
      date: D.today(),
      time: '12:00',
      title: payload.title,
      type: '其他',
      status: 'planned',
      assigneeId: null,
      note: payload.note
    });
    App.state.leave.push({
      id: App.uid('L'),
      staffId: 'S2',
      start: D.today(),
      end: D.addDays(D.today(), 1),
      reason: payload.reason,
      status: 'pending',
      createdAt: Date.now(),
      decidedBy: null,
      decidedAt: null,
      comment: payload.note
    });
    // 修改一个 staff 名字
    const s = App.state.staff[2];
    s.name = payload.name;
    s.position = payload.position;
    // 触发一条含 payload 的通知
    App.notify(s.id, `<img src=x onerror="window.__pwn6=1"> 通知: ${payload.title}`);
    App.save();
  });
  await page.waitForTimeout(500);

  // 1. content 页
  await page.evaluate(() => App.nav('content'));
  await page.waitForTimeout(500);
  const r1 = await page.evaluate(() => ({
    bodyHtml: document.body.innerHTML,
    pwn1: !!window.__pwn,
    pwn2: !!window.__pwn2,
    chipHasImg: !!document.querySelector('.chip img'),
    chipCount: document.querySelectorAll('.chip').length
  }));
  console.log('CONTENT:', JSON.stringify({
    pwn1: r1.pwn1, pwn2: r1.pwn2, chipHasImg: r1.chipHasImg, chipCount: r1.chipCount
  }));

  // 2. mine 页（含 leave.reason）
  await page.evaluate(() => App.nav('mine'));
  await page.waitForTimeout(500);
  const r2 = await page.evaluate(() => ({
    pwn3: !!window.__pwn3,
    hasImgInMine: !!document.querySelector('main .content img'),
    leaveRows: document.querySelectorAll('.tbl tbody tr').length
  }));
  console.log('MINE:', JSON.stringify(r2));

  // 3. staff 页（含 s.name/s.position）
  await page.evaluate(() => App.nav('staff'));
  await page.waitForTimeout(500);
  const r3 = await page.evaluate(() => ({
    pwn4: !!window.__pwn4,
    pwn5: !!window.__pwn5,
    hasOnmouseover: !!document.querySelector('[onmouseover]'),
    hasBoldBad: document.body.textContent.includes('<b onmouseover')
  }));
  console.log('STAFF:', JSON.stringify(r3));

  // 4. 通知面板（铃铛）
  const r4 = await page.evaluate(() => {
    document.querySelector('.bell').click();
    return {
        pwn6: !!window.__pwn6,
        bellPanelHtml: document.getElementById('bell-panel') ? document.getElementById('bell-panel').innerHTML.slice(0, 500) : ''
      };
  });
  console.log('BELL:', JSON.stringify({
    pwn6: r4.pwn6,
    hasImgInBell: r4.bellPanelHtml.includes('<img'),
    bellSample: r4.bellPanelHtml.match(/<div class="notif[^"]*">([^<]*)/)?.[1]?.slice(0,80) || ''
  }));

  // 5. roster 页（含 s.name 嵌入和 title 属性）
  await page.evaluate(() => App.nav('roster'));
  await page.waitForTimeout(500);
  const r5 = await page.evaluate(() => ({
    nameColHtml: document.querySelector('.name-col')?.innerHTML || ''
  }));
  console.log('ROSTER:', JSON.stringify({
    hasImgInName: r5.nameColHtml.includes('<img'),
    nameColSnippet: r5.nameColHtml.slice(0, 200)
  }));

  console.log('---');
  console.log('PAGE_ERRORS:', pageErrs.length, pageErrs.slice(0, 3));

  // 关键断言
  const ok = !r1.pwn1 && !r1.pwn2 && !r2.pwn3 && !r3.pwn4 && !r3.pwn5 && !r4.pwn6
          && !r1.chipHasImg && !r3.hasOnmouseover;
  console.log('XSS_DEFENDED:', ok ? 'YES ✅' : 'NO ❌');

  await b.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });