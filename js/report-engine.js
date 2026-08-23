/* =====================================================
 * report-engine.js — VCT 三大联赛赛况战报生成引擎
 *
 * 设计约束（来自交付文档）：
 *  - 仅覆盖 EMEA / Americas / Pacific 三海外联赛
 *  - 队名统一用文档第5.3节简称表（不混用全称）
 *  - 阶段/轮次中文映射固定（第5.2节）
 *  - 时间统一北京时间 M/D（第5.4节）
 *  - 模板 schema 强约束、三赛区一致、无额外注释（第3节）
 *
 * 数据来源：vlr.gg 事件页（服务端渲染，含 Group Stage/Play-Ins/Playoffs 分栏）
 * 分组（ALPHA/OMEGA）：MVP 阶段由运营手动录入（页面表单），阶段二改为抓常规赛赛果本地算积分。
 * ===================================================== */

/* ---------- 联赛事件 ID（vlr.gg） ---------- */
const VLR_EVENTS = {
  EMEA:     { id: '2976', slug: 'vct-2026-emea-stage-2',     label: 'EMEA' },
  Americas: { id: '2977', slug: 'vct-2026-americas-stage-2', label: 'Americas' },
  Pacific:  { id: '2776', slug: 'vct-2026-pacific-stage-2',  label: 'Pacific' }
};

/* ---------- 阶段/轮次中文映射（文档第5.2节） ---------- */
const STAGE_CN = {
  'Group Stage': '常规赛',
  'Play-Ins': '入围赛',
  'Playoffs': '季后赛'
};
/* 轮次英文→中文（含胜者组/败者组/总决赛） */
function roundCN(stage, round){
  const s = STAGE_CN[stage] || stage;
  if(!round) return s;
  const r = round.trim();
  let bracket = '';
  if(/upper/i.test(r)) bracket = '胜者组';
  else if(/lower/i.test(r)) bracket = '败者组';

  let phase = '';
  if(/round\s*1\b/i.test(r) && !/quarter|semi|final/i.test(r)) phase = '第一轮';
  else if(/quarter/i.test(r)) phase = '1/4决赛';
  else if(/semi/i.test(r)) phase = '半决赛';
  else if(/grand\s*final/i.test(r)) return s + ' 总决赛';
  else if(/final/i.test(r)) phase = '决赛';
  else if(/round\s*2\b/i.test(r)) phase = '次轮';
  else if(/round\s*3\b/i.test(r)) phase = '三轮';

  if(bracket && phase) return `${s} ${bracket}${phase}`;
  if(bracket) return `${s} ${bracket}`;
  if(phase) return `${s} ${phase}`;
  return `${s} ${r}`;
}

/* ---------- 队名归一化（文档第5.3节简称表） ---------- */
/* 主映射：vlr 队名/别名 → 标准简称。兜底：中台总注册表 short。 */
const SHORT_MAP = {
  // EMEA
  'Team Liquid': 'TL', 'GIANTX': 'GX', 'GiantX': 'GX', 'Movistar KOI': 'M8', 'Team Vitality': 'VIT',
  'Natus Vincere': 'NAVI', 'PCIFIC Esports': 'PCF', 'Fnatic': 'FNC',
  'Eintracht Frankfurt': 'EF', 'BBL Esports': 'BBL', 'Team Heretics': 'TH',
  'FUT Esports': 'FUT', 'Karmine Corp': 'KC', 'Joblife': 'JL', 'Fire Flux Esports': 'FF',
  'Eternal Fire': 'ET', 'Enterprise Esports': 'EP',
  // Americas
  'Evil Geniuses': 'EG', 'FURIA Esports': 'FUR', 'ENVY': 'ENVY', 'NRG': 'NRG',
  '100 Thieves': '100T', 'Cloud9': 'C9', 'G2 Esports': 'G2', 'LOUD': 'LOUD',
  'KRÜ Esports': 'KRÜ', 'Leviatán': 'LEV', 'MIBR': 'MIBR', 'Sentinels': 'SEN',
  'BESTIA': 'BESTIA', 'M80': 'M80', '2Game Esports': '2G', 'Fluxo': 'FLUXO',
  // Pacific
  'Talon Esports': 'TS', 'DetonatioN FocusMe': 'DFM', 'Gen.G': 'GEN.G', 'FULL SENSE': 'FS',
  'DRX': 'DRX', 'T1': 'T1', 'Global Esports': 'GE', 'VARREL': 'VARREL',
  'Nongshim RedForce': 'NS', 'Rex Regum Qeon': 'RRQ', 'Paper Rex': 'PRX',
  'ZETA DIVISION': 'ZETA', 'ONSIDE GAMING': 'ONSIDE', 'QT DIG∞': 'QT',
  'Xipto Esports': 'XP', 'Sharper Esports': 'SHARP'
};

/* 从总注册表建 {name/short/aliases → short} 兜底（方案A：复用 vct-teams-seed 海外子集） */
function buildShortFallback(){
  const map = {};
  const teams = (App.state && App.state.teams) || {};
  Object.values(teams).forEach(t => {
    if(!['americas','emea','pacific'].includes(t.region)) return;
    if(t.short) map[t.short.toLowerCase()] = t.short;
    if(t.name)  map[t.name.toLowerCase()]  = t.short || t.name;
    (t.aliases || []).forEach(a => map[a.toLowerCase()] = t.short || t.name);
  });
  return map;
}

/* 建大小写不敏感索引（VLR 返回队名大小写不稳定，如 GIANTX vs GiantX） */
const _shortLower = {};
Object.keys(SHORT_MAP).forEach(k => { _shortLower[k.toLowerCase()] = SHORT_MAP[k]; });

/* 归一化队名 → 标准简称 */
App.reportNormTeam = function(rawName){
  if(!rawName) return rawName;
  const key = rawName.trim();
  const low = key.toLowerCase();
  if(_shortLower[low]) return _shortLower[low];
  const fb = buildShortFallback();
  if(fb[low]) return fb[low];
  /* 最后兜底：保留原样（未匹配到简称的队，如挑战者队，保持可读） */
  return key;
};

/* ---------- 抓取（零依赖 https，复用 vlr-scraper 范式） ---------- */
function _rget(url){
  return new Promise((resolve, reject) => {
    const https = require('https');
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': 'tz=8' }, timeout: 15000 }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', e => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/* 时间换算：vlr 多为 UTC → 北京时间(+8) */
function toBeijing(dateStr, timeRaw){
  /* dateStr: "Wed, July 15, 2026" ; timeRaw: "11:00 PM" (UTC) */
  const d = new Date(dateStr + ' ' + (timeRaw || '00:00 AM') + ' UTC');
  if(isNaN(d.getTime())) return { md: '?', dateObj: null };
  /* 转为北京时间（UTC+8） */
  const bj = new Date(d.getTime() + 8 * 3600 * 1000);
  const mm = bj.getUTCMonth() + 1;
  const dd = bj.getUTCDate();
  return { md: `${mm}/${dd}`, dateObj: bj };
}

/* 解析事件页：以 match-item 为锚点切分，每块独立解析 */
function parseEventPage(html){
  const matches = [];
  /* 日期块：wf-label mod-large（用于给 match 标日期） */
  const dateRegex = /<div class="wf-label mod-large">\s*([^<]+?)\s*<\/div>/g;
  const dateMarks = [];
  let dm;
  while((dm = dateRegex.exec(html)) !== null){
    dateMarks.push({ idx: dm.index, dateStr: dm[1].trim() });
  }
  const curDate = (pos) => {
    let d = '';
    for(const m of dateMarks){ if(m.idx <= pos) d = m.dateStr; else break; }
    return d;
  };

  /* 以 match-item 锚点切分 */
  const itemRegex = /<a[^>]*class="wf-module-item match-item[^"]*"[^>]*>/g;
  let im;
  const items = [];
  while((im = itemRegex.exec(html)) !== null){
    const start = im.index + im[0].length;
    const next = itemRegex.exec(html);
    const end = next ? next.index : html.length;
    itemRegex.lastIndex = end;
    items.push({ start, end, slice: html.slice(start, end), dateStr: curDate(im.index) });
  }

  for(const it of items){
    const match = parseMatchItem(it.slice, it.dateStr);
    if(match) matches.push(match);
  }
  return matches;
}

function parseMatchItem(item, dateStr){
  /* 时间 */
  const timeM = item.match(/match-item-time[^>]*>([^<]+?)<\/div>/);
  const timeRaw = timeM ? timeM[1].replace(/\s+/g, ' ').trim() : '';
  /* 队伍名：match-item-vs-team-name 块内 text-of 文本（含 flag span，需 strip） */
  const nameBlocks = item.match(/match-item-vs-team-name[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g) || [];
  const names = nameBlocks.map(b => {
    const t = b.match(/text-of[^>]*>([\s\S]*?)<\/div>/);
    return t ? t[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
  }).filter(Boolean);
  /* 比分（直接捕获数字/破折号） */
  const scoreBlocks = item.match(/match-item-vs-team-score[^>]*>\s*([\d-]+)\s*<\/div>/g) || [];
  const scores = scoreBlocks.map(b => {
    const m = b.match(/match-item-vs-team-score[^>]*>\s*([\d-]+)/);
    return m ? m[1].trim() : '';
  });
  if(names.length < 2 || scores.length < 2) return null;

  const completed = /mod-bg-after-(green|yellow)/.test(item) || /Completed/i.test(item);
  const scoreA = parseInt(scores[0], 10);
  const scoreB = parseInt(scores[1], 10);

  return {
    dateStr, timeRaw,
    teamA: names[0], teamB: names[1],
    scoreA: isNaN(scoreA) ? null : scoreA,
    scoreB: isNaN(scoreB) ? null : scoreB,
    completed
  };
}

/* 解析事件页里的阶段标签：每个 match-item 前的 stage 标注 */
function parseEventStages(html){
  /* vlr 在 match-item 附近用 match-item-event text 标阶段+轮次 */
  const regex = /match-item-event[^>]*>([\s\S]*?)<\/div>/g;
  const out = [];
  let m;
  while((m = regex.exec(html)) !== null){
    const txt = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if(txt) out.push(txt);
  }
  return out;
}

/* ---------- 主生成函数 ---------- */
App.reportGenerate = async function(opts){
  const { league, asOfDate, resultWindowStart, groups } = opts;
  const ev = VLR_EVENTS[league];
  if(!ev) throw new Error('未知联赛: ' + league);

  App.toast(`正在抓取 ${ev.label} 赛程…`, 'info', 3000);
  const url = `https://www.vlr.gg/event/matches/${ev.id}/${ev.slug}`;
  let html;
  try {
    const r = await _rget(url);
    if(r.status !== 200) throw new Error('HTTP ' + r.status);
    html = r.body;
  } catch(e){
    App.toast(`抓取失败：${e.message}`, 'err', 5000);
    return null;
  }

  const matches = parseEventPage(html);
  const stageLabels = parseEventStages(html);
  /* 将 stage 标签按出现顺序关联到 match（vlr 顺序一致） */
  matches.forEach((mt, i) => {
    const lbl = stageLabels[i] || '';
    /* VLR 页面不直接标 "Play-Ins"：常规赛用 "Week N"，其余 bracket 轮次归 Playoffs。
       若联赛含独立 Play-Ins（如 Americas/Pacific），由下方 hasPlayIns 区分。 */
    const hasPlayIns = league === 'Americas' || league === 'Pacific';
    let stage;
    if(/week\s*\d+/i.test(lbl)) stage = 'Group Stage';
    else if(/grand\s*final/i.test(lbl)) stage = 'Playoffs';
    else if(/round|quarter|semi|final/i.test(lbl)) stage = (hasPlayIns && /upper round 1|lower round 1/i.test(lbl)) ? 'Play-Ins' : 'Playoffs';
    else if(/play-in/i.test(lbl)) stage = 'Play-Ins';
    else if(/playoff/i.test(lbl)) stage = 'Playoffs';
    else stage = 'Group Stage';
    mt.stage = stage;
    mt.round = lbl;
  });

  /* 切分窗口 */
  const asOf = new Date(asOfDate + 'T23:59:59');
  const winStart = new Date(resultWindowStart + 'T00:00:00');
  const results = [], upcoming = [];
  matches.forEach(m => {
    const bj = toBeijing(m.dateStr, m.timeRaw);
    if(!bj.dateObj) return;
    const t = bj.dateObj;
    if(t >= winStart && t <= asOf) results.push({ ...m, md: bj.md });
    else if(t > asOf) upcoming.push({ ...m, md: bj.md });
  });

  /* 渲染模板 */
  const md = renderReport({ league: ev.label, results, upcoming, groups, asOfDate });
  return md;
};

/* ---------- 模板渲染（强约束 schema） ---------- */
function renderReport({ league, results, upcoming, groups, asOfDate }){
  let out = `## VCT ${league} 联赛 | 赛况\n\n`;

  /* ① 上周赛果：按 阶段+轮次 分块 */
  out += `上周赛果：\n`;
  const byStageRound = {};
  results.forEach(m => {
    const key = roundCN(m.stage, m.round);
    (byStageRound[key] = byStageRound[key] || []).push(m);
  });
  Object.keys(byStageRound).forEach(k => {
    const list = byStageRound[k];
    const dates = [...new Set(list.map(m => m.md))].join('、');
    out += `【${k}（${dates}）】\n`;
    for(let i = 0; i < list.length; i += 2){
      const line = list.slice(i, i + 2).map(m =>
        `${App.reportNormTeam(m.teamA)} ${m.scoreA ?? '-'} ${App.reportNormTeam(m.teamB)}`
      ).join('        ');
      out += line + '\n';
    }
  });
  out += '\n';

  /* ② 常规赛结束声明 + ③ 分组名单（手动录入） */
  out += `VCT ${league} 联赛第二赛段常规赛已全部结束！\n`;
  out += `四支直接晋级季后赛的队伍分别是：\n`;
  if(groups && groups.alphaDirect && groups.alphaDirect.length){
    out += `ALPHA组：${groups.alphaDirect.join('、')}\n`;
    out += `OMEGA组：${groups.omegaDirect.join('、')}\n`;
  }
  out += `八支进入季后赛入围赛的联赛队伍分别是：\n`;
  if(groups && groups.alphaPlayin && groups.alphaPlayin.length){
    out += `ALPHA组：${groups.alphaPlayin.join('、')}\n`;
    out += `OMEGA组：${groups.omegaPlayin.join('、')}\n`;
  }
  out += '\n';

  /* ④ 进度段（按各联赛真实阶段描述） */
  const progress = buildProgress(league, results, upcoming);
  out += progress + '\n\n';

  /* ⑤ 后续预告 */
  out += `后续赛事预告：\n`;
  const upByStage = {};
  upcoming.forEach(m => {
    const key = roundCN(m.stage, m.round);
    (upByStage[key] = upByStage[key] || []).push(m);
  });
  Object.keys(upByStage).forEach(k => {
    out += `对阵情况 ${k}：\n`;
    for(let i = 0; i < upByStage[k].length; i += 2){
      const line = upByStage[k].slice(i, i + 2).map(m =>
        `${m.md} ${App.reportNormTeam(m.teamA)} vs ${App.reportNormTeam(m.teamB)}`
      ).join('                    ');
      out += line + '\n';
    }
  });

  out += `\n*以上时间均为北京时间*\n`;
  return out;
}

/* 进度段：根据已完赛最新阶段 + 即将到来的阶段生成 */
const STAGE_ORDER = { 'Group Stage': 1, 'Play-Ins': 2, 'Playoffs': 3 };
function stageCNname(s){ return s === 'Playoffs' ? '季后赛' : s === 'Play-Ins' ? '入围赛' : '常规赛'; }
function buildProgress(league, results, upcoming){
  const rank = (arr) => arr.length ? Math.max(...arr.map(s => STAGE_ORDER[s] || 0)) : 0;
  const doneRank = rank(results.map(m => m.stage));
  const upRank = rank(upcoming.map(m => m.stage));
  const curRank = Math.max(doneRank, upRank);
  const curStage = Object.keys(STAGE_ORDER).find(k => STAGE_ORDER[k] === curRank) || 'Group Stage';
  const gsEnded = results.some(m => m.stage === 'Group Stage') || upcoming.some(m => m.stage === 'Group Stage');
  const hasUp = upcoming.length > 0;
  if(hasUp){
    return `VCT ${league} 联赛当前已进入${stageCNname(curStage)}阶段（常规赛${gsEnded ? '已结束' : '进行中'}），各队正角逐晋级席位。`;
  }
  return `VCT ${league} 联赛${stageCNname(curStage)}已收官（常规赛${gsEnded ? '已结束' : '进行中'}），本赛段全部赛程结束。`;
}
