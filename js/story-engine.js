/* =====================================================
 * story-engine.js — 赛事看点挖掘规则引擎
 *
 * 功能：
 *   1. storyData()     — 惰性加载抓取数据 + state 覆盖层合并
 *   2. findTeamKey()   — 从 'AG vs TE' 字符串中解析战队 key
 *   3. storyH2H()      — 历史对阵分析
 *   4. storyNexus()    — 阵容恩怨检测
 *   5. storyGenerate() — 看点自动生成
 *
 * 依赖：data.js (fetchRemoteTeams)、store.js (App.state)、vct-teams.js
 * ===================================================== */

/* ---------- 数据访问层 ---------- */

/* 惰性加载抓取数据 + state 覆盖层合并 */
App._fetchedTeams = null;
App.storyData = async function(){
  /* 首次调用时拉取静态文件 */
  if(!App._fetchedTeams){
    try{
      App._fetchedTeams = await fetchRemoteTeams();
    }catch(e){
      console.warn('[story] 抓取数据加载失败:', e.message);
      App._fetchedTeams = null;
    }
  }

  /* 合并：state.teams 为底座，fetched.teams 覆盖（state.manual=true 的队保留 state 版） */
  const merged = {};
  const stateTeams = App.state.teams || {};
  const fetchedTeams = (App._fetchedTeams && App._fetchedTeams.teams) || {};

  /* 先放 state 中的所有队 */
  for(const [id, team] of Object.entries(stateTeams)){
    merged[id] = JSON.parse(JSON.stringify(team));
  }

  /* 用 fetched 数据补充（不覆盖 manual=true 的队） */
  for(const [id, data] of Object.entries(fetchedTeams)){
    if(!merged[id]){
      /* state 中没有，用 fetched 创建 */
      merged[id] = {
        id, name: data.name || id, short: id.toUpperCase(),
        aliases: [], region: '', vlrId: data.vlrId || '',
        roster: data.roster || [],
        manual: false, updatedAt: 0
      };
    } else if(!merged[id].manual){
      /* 非手动编辑的队：用 fetched 的 roster 和 matches 补充 */
      if(data.roster && data.roster.length){
        /* 保留 state 中的 formerTeams，用 fetched 的 roster 补充新选手 */
        const existingIds = new Set((merged[id].roster || []).map(p => p.id));
        for(const p of data.roster){
          if(!existingIds.has(p.id)){
            merged[id].roster.push(p);
          }
        }
      }
      /* 存储近期比赛数据到临时字段（不入 state） */
      merged[id]._matches = data.matches || [];
    }
  }

  return { merged, fetchedAt: App._fetchedTeams ? App._fetchedTeams.fetchedAt : null };
};

/* 从字符串中解析战队 key（如 'AG vs TE' → ['ag', 'te']） */
App.findTeamKey = function(str){
  if(!str) return [null, null];
  const parts = str.split(/\s+vs?\s+/i).map(s => s.trim()).filter(Boolean);
  if(parts.length < 2) return [null, null];

  const teams = App.state.teams || {};
  const result = [];

  for(const part of parts){
    const upper = part.toUpperCase();
    let found = null;

    /* 1. short 全等匹配 */
    for(const [id, t] of Object.entries(teams)){
      if(t.short && t.short.toUpperCase() === upper){ found = id; break; }
    }
    if(found){ result.push(found); continue; }

    /* 2. id 全等 */
    if(teams[part.toLowerCase()]){ result.push(part.toLowerCase()); continue; }

    /* 3. aliases 匹配 */
    for(const [id, t] of Object.entries(teams)){
      if((t.aliases || []).some(a => a.toUpperCase() === upper)){ found = id; break; }
    }
    if(found){ result.push(found); continue; }

    /* 4. name 包含匹配 */
    for(const [id, t] of Object.entries(teams)){
      if(t.name && t.name.toUpperCase().includes(upper)){ found = id; break; }
    }
    if(found){ result.push(found); continue; }

    /* 5. 前缀退化匹配（TE vs TEC → 先匹配 TE 全等） */
    for(const [id, t] of Object.entries(teams)){
      if(t.short && t.short.toUpperCase() === upper){ found = id; break; }
    }
    if(found){ result.push(found); continue; }

    result.push(null);
  }

  return [result[0], result[1]];
};

/* 构造 matchup key（字典序） */
App.matchupKey = function(a, b){
  return [a, b].sort().join('-vs-');
};

/* ---------- H2H 历史对阵分析 ---------- */
App.storyH2H = function(keyA, keyB){
  const data = App._fetchedTeams;
  const stateMatchups = App.state.matchups || {};
  const mKey = App.matchupKey(keyA, keyB);
  const stateMu = stateMatchups[mKey] || { history: [], notes: [] };

  /* 收集两队互相对阵的记录 */
  const h2hMatches = [];

  /* 从 fetched 数据中提取互相对阵 */
  if(data && data.teams){
    const teamA = data.teams[keyA];
    const teamB = data.teams[keyB];
    if(teamA && teamA.matches){
      for(const m of teamA.matches){
        const oppShort = (m.oppShort || '').toUpperCase();
        const teamBShort = (App.state.teams[keyB] || {}).short || keyB.toUpperCase();
        if(oppShort === teamBShort || oppShort === keyB.toUpperCase()){
          h2hMatches.push({
            date: m.date, event: m.event, stage: m.stage,
            score: m.score, winner: m.result === 'win' ? keyA : keyB,
            bo: m.bo, source: 'vlr'
          });
        }
      }
    }
    /* 反向也查（teamB 的记录中 vs teamA） */
    if(teamB && teamB.matches){
      for(const m of teamB.matches){
        const oppShort = (m.oppShort || '').toUpperCase();
        const teamAShort = (App.state.teams[keyA] || {}).short || keyA.toUpperCase();
        if(oppShort === teamAShort || oppShort === keyA.toUpperCase()){
          /* 避免重复 */
          if(!h2hMatches.find(h => h.date === m.date && h.score === m.score)){
            h2hMatches.push({
              date: m.date, event: m.event, stage: m.stage,
              score: m.score, winner: m.result === 'win' ? keyB : keyA,
              bo: m.bo, source: 'vlr'
            });
          }
        }
      }
    }
  }

  /* 合并 state 中的手动记录 */
  for(const h of (stateMu.history || [])){
    if(!h2hMatches.find(m => m.date === h.date && m.score === h.score)){
      h2hMatches.push(h);
    }
  }

  /* 按日期倒序 */
  h2hMatches.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  /* 统计胜负 */
  let winsA = 0, winsB = 0, mapsA = 0, mapsB = 0;
  for(const m of h2hMatches){
    if(m.winner === keyA) winsA++;
    else if(m.winner === keyB) winsB++;
    /* 小局比分累加 */
    if(m.score && m.score.includes(':')){
      const [sa, sb] = m.score.split(':').map(Number);
      if(!isNaN(sa) && !isNaN(sb)){ mapsA += sa; mapsB += sb; }
    }
  }
  const total = h2hMatches.length;
  const mapTotal = mapsA + mapsB;

  /* 近 5 场状态（对任意对手，从 fetched 数据提取） */
  const formA = App._recentForm(keyA);
  const formB = App._recentForm(keyB);

  /* 趋势检测 */
  let streak = 0, streakTeam = null;
  if(h2hMatches.length > 0){
    streakTeam = h2hMatches[0].winner;
    for(const m of h2hMatches){
      if(m.winner === streakTeam) streak++;
      else break;
    }
  }

  /* 关键场次筛选：BO5 或比分鏖战(2:1/3:2) 或季后赛 */
  const keyMatches = h2hMatches.filter(m =>
    m.bo === 'BO5' ||
    (m.score && /^(2:1|3:2|1:2|2:3)$/.test(m.score)) ||
    (m.stage && /决赛|淘汰|季后赛|playoff/i.test(m.stage))
  ).slice(0, 5);

  return {
    total, wins: { a: winsA, b: winsB },
    recent: h2hMatches.slice(0, 10),
    form: { a: formA, b: formB },
    trend: streak >= 2 ? `${streakTeam}-${streak}win` : '',
    keyMatches,
    mapWinRate: mapTotal > 0 ? { a: mapsA/mapTotal, b: mapsB/mapTotal } : { a: 0, b: 0 },
    notes: stateMu.notes || []
  };
};

/* 近期状态（近5场 W/L 字符串） */
App._recentForm = function(teamKey){
  const data = App._fetchedTeams;
  if(!data || !data.teams || !data.teams[teamKey]) return '';
  const matches = (data.teams[teamKey].matches || [])
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 5);
  return matches.map(m => m.result === 'win' ? 'W' : 'L').join('');
};

/* ---------- 阵容恩怨检测 ---------- */
App.storyNexus = function(keyA, keyB){
  const teams = App.state.teams || {};
  const teamA = teams[keyA];
  const teamB = teams[keyB];
  if(!teamA || !teamB) return { links: [], rosterA: [], rosterB: [] };

  const rosterA = teamA.roster || [];
  const rosterB = teamB.roster || [];
  const links = [];

  /* 笛卡尔积检测 */
  for(const pA of rosterA){
    for(const pB of rosterB){
      /* 1. 昔日队友重逢：pA.formerTeams 包含 keyB，或 pB.formerTeams 包含 keyA */
      if((pA.formerTeams || []).includes(keyB)){
        links.push({
          type: 'reunion', players: [pA.name, pB.name], team: keyB,
          text: `${pA.name}（${teamA.short}）曾效力于 ${teamB.name}，将与旧队友 ${pB.name} 正面对决`,
          weight: 8
        });
      }
      if((pB.formerTeams || []).includes(keyA)){
        links.push({
          type: 'revenge', players: [pB.name, pA.name], team: keyA,
          text: `${pB.name}（${teamB.short}）曾效力于 ${teamA.name}，此番面对旧主`,
          weight: 9
        });
      }

      /* 2. 共同前队：两人在同一前队效力过 */
      const common = (pA.formerTeams || []).filter(t => (pB.formerTeams || []).includes(t));
      if(common.length > 0){
        links.push({
          type: 'reunion', players: [pA.name, pB.name], team: common[0],
          text: `${pA.name}（${teamA.short}）与 ${pB.name}（${teamB.short}）曾共同效力于 ${common[0]}`,
          weight: 8
        });
      }

      /* 3. 同国籍（非同赛区） */
      if(pA.country && pA.country === pB.country && teamA.region !== teamB.region){
        const countryNames = { cn:'中国', kr:'韩国', jp:'日本', us:'美国', br:'巴西', gb:'英国',
          fi:'芬兰', tr:'土耳其', es:'西班牙', ru:'俄罗斯', th:'泰国', id:'印尼',
          cl:'智利', pl:'波兰', de:'德国', fr:'法国', se:'瑞典', ca:'加拿大' };
        const cName = countryNames[pA.country] || pA.country.toUpperCase();
        links.push({
          type: 'compatriot', players: [pA.name, pB.name], country: pA.country,
          text: `${pA.name} 与 ${pB.name} 同为${cName}籍选手，国际赛场同乡对决`,
          weight: 3
        });
      }

      /* 4. 同位置对位（都是 duelist 或都是 igl） */
      if(pA.role && pA.role === pB.role && pA.role !== ''){
        const roleNames = { duelist:'决斗者', initiator:'先锋', controller:'控场', sentinel:'哨位', igl:'指挥' };
        const rName = roleNames[pA.role] || pA.role;
        links.push({
          type: 'duel', players: [pA.name, pB.name],
          text: `${pA.name}（${teamA.short}）与 ${pB.name}（${teamB.short}）同为${rName}位，王牌正面对位`,
          weight: 6
        });
      }
    }
  }

  /* 5. 人工备注透传 */
  const mKey = App.matchupKey(keyA, keyB);
  const stateMu = (App.state.matchups || {})[mKey];
  if(stateMu && stateMu.notes){
    for(const note of stateMu.notes){
      links.push({
        type: 'manual', players: [],
        text: note.text,
        weight: 7
      });
    }
  }

  /* 去重 + 按 weight 排序 */
  const seen = new Set();
  const unique = links.filter(l => {
    const key = l.text;
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => b.weight - a.weight);

  return { links: unique, rosterA, rosterB };
};

/* ---------- 看点自动生成 ---------- */
App.storyGenerate = function(matchKey, date, teamsStr){
  /* 解析 matchKey 获取两队 */
  const parts = matchKey.split('-vs-');
  if(parts.length < 2) return { created: 0, skipped: 0 };
  const keyA = parts[0], keyB = parts[1];

  const h2h = App.storyH2H(keyA, keyB);
  const nexus = App.storyNexus(keyA, keyB);

  /* 检查是否已存在看点（edited=true 的不覆盖） */
  const existing = (App.state.highlights || []).find(h =>
    h.matchKey === matchKey && h.edited === true
  );
  if(existing) return { created: 0, skipped: 1 };

  /* 生成候选标签池 */
  const candidates = [];

  /* H2H 标签 */
  const winRateA = h2h.total > 0 ? h2h.wins.a / h2h.total : 0;
  const winRateB = h2h.total > 0 ? h2h.wins.b / h2h.total : 0;
  const winRateDiff = Math.abs(winRateA - winRateB);

  if(h2h.total === 0){
    candidates.push({ tag: '遭遇战', text: '两队近年首次正式交手', weight: 5 });
  }
  if(h2h.total >= 3 && Math.max(winRateA, winRateB) >= 0.7){
    const dominant = winRateA > winRateB ? keyA : keyB;
    const teamName = (App.state.teams[dominant] || {}).name || dominant;
    candidates.push({ tag: '历史压制', text: `双方近 ${h2h.total} 次交手 ${teamName} ${Math.max(h2h.wins.a, h2h.wins.b)} 胜 ${Math.min(h2h.wins.a, h2h.wins.b)} 负占据绝对优势`, weight: 10 });
  }
  if(h2h.total >= 5 && winRateDiff <= 0.2){
    candidates.push({ tag: '宿敌之战', text: `双方近 ${h2h.total} 次交手胜负各半，堪称宿敌对决`, weight: 7 });
  }
  if(h2h.trend){
    const [tTeam, tCount] = h2h.trend.match(/(\w+)-(\d+)win/).slice(1);
    const teamName = (App.state.teams[tTeam] || {}).name || tTeam;
    candidates.push({ tag: '连胜之势', text: `${teamName} 近期对阵连胜 ${tCount} 场，状态正热`, weight: 6 });
  }
  /* 复仇之战：上次交手失利方 */
  if(h2h.recent.length > 0){
    const lastWinner = h2h.recent[0].winner;
    const loser = lastWinner === keyA ? keyB : keyA;
    const loserName = (App.state.teams[loser] || {}).name || loser;
    candidates.push({ tag: '复仇之战', text: `${loserName} 上次交手落败，此番誓要复仇`, weight: 8 });
  }

  /* 阵容恩怨标签 */
  for(const link of nexus.links){
    if(link.type === 'revenge'){
      candidates.push({ tag: '旧主对决', text: link.text, weight: 9 });
    } else if(link.type === 'reunion'){
      candidates.push({ tag: '昔日队友重逢', text: link.text, weight: 8 });
    } else if(link.type === 'duel'){
      candidates.push({ tag: '王牌对位', text: link.text, weight: 6 });
    } else if(link.type === 'compatriot'){
      candidates.push({ tag: '同乡德比', text: link.text, weight: 3 });
    } else if(link.type === 'manual'){
      candidates.push({ tag: '恩怨焦点', text: link.text, weight: 7 });
    }
  }

  /* 排序取 Top 5 标签 */
  candidates.sort((a, b) => b.weight - a.weight);
  const topTags = candidates.slice(0, 5).map(c => c.tag);
  const allTexts = candidates.map(c => c.text);

  /* 拼装摘要 */
  const teamAName = (App.state.teams[keyA] || {}).name || keyA;
  const teamBName = (App.state.teams[keyB] || {}).name || keyB;
  let summary = '';

  /* 开头：H2H 战绩 */
  if(h2h.total > 0){
    summary += `双方近 ${h2h.total} 次交手，${teamAName} ${h2h.wins.a} 胜 ${h2h.wins.b} 负`;
    if(h2h.total >= 3) summary += `（小局胜率 ${(h2h.mapWinRate.a * 100).toFixed(0)}% vs ${(h2h.mapWinRate.b * 100).toFixed(0)}%）`;
    summary += '。';
  } else {
    summary += `两队近年首次正式交手。`;
  }

  /* 中段：恩怨链接 */
  const nexusTexts = allTexts.filter(t => !t.startsWith('双方近') && !t.startsWith('两队近年'));
  if(nexusTexts.length > 0){
    summary += nexusTexts.slice(0, 3).join('；') + '。';
  }

  /* 结尾：趋势 */
  if(h2h.trend){
    summary += allTexts.find(t => t.includes('连胜')) || '';
  }

  /* 写入 state.highlights */
  App.pushHistory('story');
  /* 删除同 matchKey 的旧 draft 看点 */
  App.state.highlights = (App.state.highlights || []).filter(h =>
    !(h.matchKey === matchKey && h.status === 'draft' && !h.edited)
  );
  const hl = {
    id: App.uid('H'),
    matchKey, date: date || D.today(),
    teams: teamsStr || `${teamAName} vs ${teamBName}`,
    tags: topTags,
    title: topTags.length > 0 ? `${topTags[0]}：${teamAName} vs ${teamBName}` : `${teamAName} vs ${teamBName} 赛事看点`,
    summary,
    status: 'draft',
    edited: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  App.state.highlights.unshift(hl);
  App.save();

  return { created: 1, skipped: 0, highlight: hl };
};
