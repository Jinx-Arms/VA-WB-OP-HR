#!/usr/bin/env node
/* =====================================================
 * scrape.js — 独立 VLR 赛程抓取脚本（供 GitHub Actions 运行）
 *
 * 用法：node scripts/scrape.js
 * 输出：data/fetched-schedule.json
 * ===================================================== */
'use strict';
const { fetchVLRSchedule } = require('../js/vlr-scraper.js');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('[VLR] 开始抓取赛程...');
  try {
    const result = await fetchVLRSchedule();
    const dayCount = Object.keys(result.days).length;
    console.log('[VLR] 抓取完成: %d 个比赛日, %d 个错误', dayCount, result.errors.length);
    if (result.errors.length) {
      result.errors.forEach(e => console.log('  ⚠ %s: %s', e.event, e.error));
    }

    const outDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'fetched-schedule.json');
    fs.writeFileSync(outFile, JSON.stringify(result, null, 2), 'utf8');
    console.log('[VLR] 已写入: %s', outFile);
    process.exit(0);
  } catch (e) {
    console.error('[VLR] 抓取失败:', e.message);
    process.exit(1);
  }
})();
