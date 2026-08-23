#!/usr/bin/env node
/* 验证「同步官方赛程」后渲染的时间是否为北京时间口径 + 带标注 */
'use strict';
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROOT = path.join(__dirname, '..');
const PORT = 3221;
const BASE = `http://localhost:${PORT}`;

function waitForServer(url, tries = 40){
  return new Promise((resolve, reject) => {
    let n = 0;
    const tick = () => {
      http.get(url, res => { resolve(true); res.destroy(); })
        .on('error', () => {
          if(++n > tries) return reject(new Error('server timeout'));
          setTimeout(tick, 300);
        });
    };
    tick();
  });
}

(async () => {
  // 启动本地 server（磁盘模式）
  const srv = spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(PORT) }) });
  srv.stdout.on('data', () => {});
  srv.stderr.on('data', d => process.stderr.write('[srv] ' + d));

  await waitForServer(BASE + '/index.html');

  const { chromium } = (() => { try { return require('playwright'); } catch(e){ return {}; } })();
  if(!chromium){
    console.error('PLAYWRIGHT_MISSING');
    // 用 chrome headless + CDP 简单兜底：直接抓 HTML 验证
    srv.kill();
    process.exit(2);
  }

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if(m.type()==='error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERR: ' + e.message));

  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  // 登录 s1
  await page.fill('#login-user', 's1');
  await page.fill('#login-pwd', 'vct2026');
  await page.evaluate(() => App.doLogin());
  await page.waitForTimeout(1000);
  // 进赛程页
  await page.evaluate(() => App.nav('schedule'));
  await page.waitForTimeout(800);
  // 点同步
  await page.evaluate(() => App.doSync());
  await page.waitForTimeout(1500);

  // 抓取赛程单元格里的时间标注
  const sample = await page.evaluate(() => {
    const lines = [...document.querySelectorAll('.match-line')].slice(0, 6).map(el => el.textContent.trim());
    const tzTags = document.querySelectorAll('.tz-tag').length;
    const head = document.querySelector('.card h3 .hint') ? document.querySelector('.card h3 .hint').textContent : '';
    return { lines, tzTags, head };
  });

  console.log('HEAD_HINT:', sample.head);
  console.log('TZ_TAG_COUNT:', sample.tzTags);
  console.log('MATCH_LINES:');
  sample.lines.forEach(l => console.log('  ', l));
  console.log('CONSOLE_ERRORS:', errors.length ? errors.join(' | ') : 'none');

  await browser.close();
  srv.kill();

  // 判定：每行都含「北京时间」且时间不是 0x:xx 美东凌晨档
  const allLabelled = sample.lines.every(l => l.includes('北京时间'));
  const hasUSNight = sample.lines.some(l => /^0\d:/.test(l));
  console.log('CHECK_ALL_LABELLED:', allLabelled);
  console.log('CHECK_NO_US_NIGHT:', !hasUSNight);
  process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
