/* =====================================================
 * vlr-scraper.js — VLR.gg 赛程抓取器（零依赖）
 * 定时从 VLR.gg 抓取赛事页面，解析 HTML 生成 scheduleDays
 * 通过 Cookie tz=8 获取北京时间
 * ===================================================== */
'use strict';
const https = require('https');

/* ---------- 配置：追踪的 VLR 赛事 ---------- */
const VLR_EVENTS = [
  { id: '2978', label: 'VCT CN 2026 第二赛段',
    url: 'https://www.vlr.gg/event/matches/2978/vct-2026-china-stage-2' },
  // 上海全球冠军赛 VLR 页面上线后在此添加：
  // { id: 'xxxx', label: '2026 上海全球冠军赛', url: 'https://www.vlr.gg/event/matches/xxxx/...' },
];

/* ---------- URL slug → 中文轮次/阶段 ---------- */
const SLUG_MAP = {
  w1:'第1周', w2:'第2周', w3:'第3周',
  seeding:'种子排位赛',
  ur1:'入围赛·胜者组第一轮', ur2:'入围赛·胜者组第二轮',
  ubqf:'胜者组四分之一决赛', ubsf:'胜者组半决赛', ubf:'胜者组决赛',
  lr1:'败者组第一轮', lr2:'败者组第二轮', lr3:'败者组第三轮',
  lqf:'败者组四分之一决赛', lsf:'败者组半决赛', lbf:'败者组决赛',
  gf:'总决赛', grnf:'分组赛',
};

const MONTHS = { January:1,February:2,March:3,April:4,May:5,June:6,
  July:7,August:8,September:9,October:10,November:11,December:12 };

/* ---------- HTTP 请求 ---------- */
function fetchPage(url){
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'Cookie': 'tz=8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      timeout: 15000,
    }, res => {
      if(res.statusCode !== 200){
        reject(new Error('HTTP ' + res.statusCode));
        res.resume();
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
  });
}

/* ---------- 解析日期 "Wed, August 5, 2026" → "2026-08-05" ---------- */
function parseDate(text){
  const m = text.match(/(\w+)\s+(\d+),\s*(\d+)/);
  if(!m) return null;
  const month = MONTHS[m[1]];
  if(!month) return null;
  return m[3] + '-' + String(month).padStart(2,'0') + '-' + String(m[2]).padStart(2,'0');
}

/* ---------- 解析时间 "4:00 PM" → "16:00" ---------- */
function parseTime(text){
  const m = text.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if(!m) return '';
  let h = parseInt(m[1]);
  const min = m[2];
  const ap = m[3].toUpperCase();
  if(ap === 'PM' && h !== 12) h += 12;
  if(ap === 'AM' && h === 12) h = 0;
  return String(h).padStart(2,'0') + ':' + min;
}

/* ---------- 提取纯文本（去标签） ---------- */
function stripTags(html){
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g,'&').replace(/&ndash;/g,'-')
    .replace(/&amp;ndash;/g,'-').replace(/\s+/g,' ').trim();
}

/* ---------- 从 URL 提取 slug ---------- */
function extractSlug(href){
  const parts = (href || '').split('-');
  return parts[parts.length - 1].replace(/\/$/, '');
}

/* ---------- 判断 BO 赛制 ---------- */
function detectBO(slug, seriesText){
  const s = (slug + ' ' + seriesText).toLowerCase();
  if(/(gf|grand.final|lbf|lower.final|总决|败决)/.test(s)) return 'BO5';
  return 'BO3';
}

/* ---------- 解析单个 VLR 赛事页面 ---------- */
function parseVLRPage(html, eventLabel){
  const days = {};

  // 按日期标题分割
  const sections = html.split('wf-label mod-large');

  for(let i = 1; i < sections.length; i++){
    const section = sections[i];

    // 提取日期文本（到第一个 </div>）
    const dateText = section.split('</div>')[0];
    const dateStr = parseDate(stripTags(dateText));
    if(!dateStr) continue;

    // 用正则匹配完整的 <a> 比赛条目（href + 内容一起捕获）
    const matchRegex = /<a\s+href="([^"]+)"[^>]*class="[^"]*wf-module-item match-item[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    const matches = [];
    let m;

    while((m = matchRegex.exec(section)) !== null){
      const href = m[1];
      const matchHTML = m[2];
      const slug = extractSlug(href);

      // 提取时间
      const timeMatch = matchHTML.match(/match-item-time[^>]*>([\s\S]*?)<\/div>/);
      const time = timeMatch ? parseTime(stripTags(timeMatch[1])) : '';

      // 提取队伍名（match-item-vs-team-name 内的 text-of）
      const teamRegex = /match-item-vs-team-name[^>]*>[\s\S]*?text-of[^>]*>([\s\S]*?)<\/div>/g;
      const teams = [];
      let tm;
      while((tm = teamRegex.exec(matchHTML)) !== null){
        const name = stripTags(tm[1]);
        if(name) teams.push(name);
      }
      if(teams.length < 2) continue;

      // 提取轮次/阶段
      const seriesMatch = matchHTML.match(/match-item-event-series[^>]*>([\s\S]*?)<\/div>/);
      const seriesText = seriesMatch ? stripTags(seriesMatch[1]) : '';
      const stageMatch = matchHTML.match(/match-item-event\s+text-of[^>]*>([\s\S]*?)<\/div>/);
      let stageText = '';
      if(stageMatch){
        const full = stripTags(stageMatch[1]);
        stageText = seriesText ? full.replace(seriesText, '').trim() : full;
      }

      const roundCN = SLUG_MAP[slug] || slug || seriesText || '比赛';
      const stageLabel = [roundCN, stageText].filter(Boolean).join(' · ');
      const bo = detectBO(slug, seriesText + ' ' + stageText);

      matches.push({
        time: time || 'TBD',
        name: eventLabel + ' ' + stageLabel,
        stage: stageLabel,
        bo: bo,
        teams: teams.join(' vs '),
      });
    }

    if(matches.length > 0){
      days[dateStr] = { type: 'match', manual: false, matches };
    }
  }

  return days;
}

/* ---------- 主入口：抓取所有赛事 ---------- */
async function fetchVLRSchedule(){
  const allDays = {};
  const errors = [];

  for(const event of VLR_EVENTS){
    try{
      const html = await fetchPage(event.url);
      const eventDays = parseVLRPage(html, event.label);
      const count = Object.keys(eventDays).length;
      console.log('[VLR] %s: 抓取到 %d 个比赛日', event.label, count);
      Object.assign(allDays, eventDays);
    }catch(e){
      console.error('[VLR] %s 抓取失败: %s', event.label, e.message);
      errors.push({ event: event.label, error: e.message });
    }
  }

  return { days: allDays, errors, fetchedAt: new Date().toISOString() };
}

module.exports = { fetchVLRSchedule, fetchVLRTeams, VLR_EVENTS, parseVLRPage, parseDate, parseTime };

/* =====================================================
 * VLR 战队页面抓取（roster + 完赛记录）
 * ===================================================== */

/* ---------- 战队页 URL 构造 ---------- */
function teamMatchesUrl(vlrId){
  return `https://www.vlr.gg/team/matches/${vlrId}/?group=completed`;
}
function teamPageUrl(vlrId){
  return `https://www.vlr.gg/team/${vlrId}/`;
}

/* ---------- 国家旗标 CSS class → ISO 国家码 ---------- */
const FLAG_MAP = {
  'mod-flag-us':'us','mod-flag-ca':'ca','mod-flag-br':'br','mod-flag-ar':'ar',
  'mod-flag-cl':'cl','mod-flag-mx':'mx','mod-flag-co':'co','mod-flag-pe':'pe',
  'mod-flag-gb':'gb','mod-flag-fi':'fi','mod-flag-se':'se','mod-flag-no':'no',
  'mod-flag-dk':'dk','mod-flag-de':'de','mod-flag-fr':'fr','mod-flag-es':'es',
  'mod-flag-it':'it','mod-flag-nl':'nl','mod-flag-pl':'pl','mod-flag-tr':'tr',
  'mod-flag-ru':'ru','mod-flag-ua':'ua','mod-flag-kr':'kr','mod-flag-jp':'jp',
  'mod-flag-cn':'cn','mod-flag-th':'th','mod-flag-id':'id','mod-flag-ph':'ph',
  'mod-flag-vn':'vn','mod-flag-in':'in','mod-flag-au':'au','mod-flag-my':'my',
  'mod-flag-sg':'sg','mod-flag-tw':'tw','mod-flag-pt':'pt','mod-flag-lt':'lt',
};

/* ---------- 解析战队页 roster ---------- */
function parseTeamRoster(html){
  const players = [];
  /* VLR roster 区域：wf-card 内 player-row / player-name / flag / role */
  const rowRegex = /player-row[\s\S]*?<\/div>\s*<\/div>/g;
  const rows = html.match(rowRegex) || [];

  for(const row of rows){
    /* 选手名 */
    const nameMatch = row.match(/player-name[\s\S]*?text-of[^>]*>([\s\S]*?)<\//);
    const name = nameMatch ? stripTags(nameMatch[1]).trim() : '';
    if(!name) continue;

    /* 国籍（flag CSS class） */
    let country = '';
    const flagMatch = row.match(/mod-flag\s+(\S+)/);
    if(flagMatch){
      const flagCls = flagMatch[0].trim();
      country = FLAG_MAP[flagCls] || '';
    }

    /* 角色（role 文本） */
    let role = '';
    const roleMatch = row.match(/player-role[\s\S]*?>([\s\S]*?)<\//);
    if(roleMatch){
      const roleText = stripTags(roleMatch[1]).toLowerCase().trim();
      if(roleText.includes('igl') || roleText.includes('指挥')) role = 'igl';
      else if(roleText.includes('duel') || roleText.includes('突破')) role = 'duelist';
      else if(roleText.includes('init') || roleText.includes('先锋')) role = 'initiator';
      else if(roleText.includes('controller') || roleText.includes('控场')) role = 'controller';
      else if(roleText.includes('sentinel') || roleText.includes('哨位')) role = 'sentinel';
    }

    players.push({
      id: 'p-' + name.toLowerCase().replace(/[^a-z0-9]/g, ''),
      name, country: country || 'unknown', role: role || '',
      joined: '', formerTeams: [], source: 'vlr'
    });
  }
  return players;
}

/* ---------- 解析战队完赛记录 ---------- */
function parseTeamMatches(html){
  const matches = [];
  /* 按日期标题分割 */
  const sections = html.split('wf-label mod-large');

  for(let i = 1; i < sections.length; i++){
    const section = sections[i];
    const dateText = section.split('</div>')[0];
    const dateStr = parseDate(stripTags(dateText));
    if(!dateStr) continue;

    /* 匹配比赛条目 */
    const matchRegex = /<a\s+href="([^"]+)"[^>]*class="[^"]*wf-module-item match-item[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while((m = matchRegex.exec(section)) !== null){
      const matchHTML = m[2];

      /* 对手名 */
      const teamRegex = /match-item-vs-team-name[^>]*>[\s\S]*?text-of[^>]*>([\s\S]*?)<\/div>/g;
      const teams = [];
      let tm;
      while((tm = teamRegex.exec(matchHTML)) !== null){
        const name = stripTags(tm[1]);
        if(name) teams.push(name);
      }
      if(teams.length < 2) continue;

      /* 比分（score: "2:1"） */
      const scoreMatch = matchHTML.match(/match-item-vs-team-score[^>]*>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/);
      const score = scoreMatch ? stripTags(scoreMatch[1]).replace(/\s/g,'') : '';

      /* 赛事名 */
      const eventMatch = matchHTML.match(/match-item-event\s+text-of[^>]*>([\s\S]*?)<\/div>/);
      const event = eventMatch ? stripTags(eventMatch[1]).trim() : '';

      /* 轮次 */
      const seriesMatch = matchHTML.match(/match-item-event-series[^>]*>([\s\S]*?)<\/div>/);
      const stage = seriesMatch ? stripTags(seriesMatch[1]).trim() : '';

      /* BO 赛制 */
      const bo = detectBO('', stage + ' ' + event);

      /* 胜负（第一队是自己 = win，第二队是对手） */
      const result = score ? (parseInt(score.split(':')[0]) > parseInt(score.split(':')[1]) ? 'win' : 'loss') : '';

      matches.push({
        date: dateStr,
        event,
        stage,
        opponent: teams[1],
        oppShort: teams[1].replace(/\s/g,''),
        score,
        result,
        bo
      });
    }
  }
  return matches;
}

/* ---------- 主入口：抓取所有战队数据 ----------
 * teamList: [{ id, vlrId, name, short }]（vlrId 为空的跳过）
 * 带限速 800ms 防封禁
 */
async function fetchVLRTeams(teamList){
  const teams = {};
  const errors = [];
  const valid = teamList.filter(t => t.vlrId);
  const skipped = teamList.length - valid.length;

  if(skipped > 0){
    console.log('[VLR Teams] 跳过 %d 个无 vlrId 的战队', skipped);
  }

  for(const team of valid){
    try{
      /* 先抓 roster 页 */
      const rosterHtml = await fetchPage(teamPageUrl(team.vlrId));
      const roster = parseTeamRoster(rosterHtml);
      await sleep(800);

      /* 再抓完赛记录页 */
      const matchesHtml = await fetchPage(teamMatchesUrl(team.vlrId));
      const matches = parseTeamMatches(matchesHtml);
      await sleep(800);

      teams[team.id] = {
        name: team.name,
        vlrId: team.vlrId,
        roster,
        matches
      };
      console.log('[VLR Teams] %s: roster %d 人, 完赛 %d 场', team.short || team.id, roster.length, matches.length);
    }catch(e){
      console.error('[VLR Teams] %s 抓取失败: %s', team.short || team.id, e.message);
      errors.push({ team: team.short || team.id, error: e.message });
    }
  }

  return { teams, errors, fetchedAt: new Date().toISOString() };
}

/* ---------- 限速辅助 ---------- */
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
