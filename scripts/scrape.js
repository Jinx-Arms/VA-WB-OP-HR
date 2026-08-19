#!/usr/bin/env node
/* =====================================================
 * scrape.js — 独立 VLR 抓取脚本（供 GitHub Actions 运行）
 *
 * 用法：node scripts/scrape.js
 * 输出：data/fetched-schedule.json + data/fetched-teams.json
 * ===================================================== */
'use strict';
const { fetchVLRSchedule, fetchVLRTeams } = require('../js/vlr-scraper.js');
const { VCT_TEAMS } = require('../js/vct-teams.js');
const fs = require('fs');
const path = require('path');

(async () => {
  const outDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  /* ---------- 1. 抓取赛程 ---------- */
  console.log('[VLR] 开始抓取赛程...');
  try {
    const result = await fetchVLRSchedule();
    const dayCount = Object.keys(result.days).length;
    console.log('[VLR] 赛程抓取完成: %d 个比赛日, %d 个错误', dayCount, result.errors.length);
    if (result.errors.length) {
      result.errors.forEach(e => console.log('  ⚠ %s: %s', e.event, e.error));
    }
    const scheduleFile = path.join(outDir, 'fetched-schedule.json');
    fs.writeFileSync(scheduleFile, JSON.stringify(result, null, 2), 'utf8');
    console.log('[VLR] 赛程已写入: %s', scheduleFile);
  } catch (e) {
    console.error('[VLR] 赛程抓取失败:', e.message);
  }

  /* ---------- 2. 抓取战队数据 ---------- */
  console.log('\n[VLR Teams] 开始抓取战队数据...');
  const teamsFile = path.join(outDir, 'fetched-teams.json');

  /* 增量合并：读取旧文件作为兜底 */
  let oldData = null;
  try {
    if (fs.existsSync(teamsFile)) {
      oldData = JSON.parse(fs.readFileSync(teamsFile, 'utf8'));
    }
  } catch(e) {
    console.warn('[VLR Teams] 读取旧文件失败:', e.message);
  }

  try {
    const result = await fetchVLRTeams(VCT_TEAMS);
    const teamCount = Object.keys(result.teams).length;
    console.log('[VLR Teams] 战队抓取完成: %d 队, %d 个错误', teamCount, result.errors.length);
    if (result.errors.length) {
      result.errors.forEach(e => console.log('  ⚠ %s: %s', e.team, e.error));
    }

    /* 增量合并：新数据覆盖旧数据，抓取失败的队沿用旧数据 */
    let merged = result;
    if(oldData && oldData.teams){
      for(const [id, data] of Object.entries(oldData.teams)){
        if(!merged.teams[id]){
          merged.teams[id] = data;
          console.log('  ℹ %s 沿用旧数据', id);
        }
      }
    }

    fs.writeFileSync(teamsFile, JSON.stringify(merged, null, 2), 'utf8');
    console.log('[VLR Teams] 已写入: %s', teamsFile);
  } catch (e) {
    console.error('[VLR Teams] 战队抓取失败:', e.message);
    /* 抓取整体失败时保留旧文件不覆盖 */
  }

  process.exit(0);
})();
