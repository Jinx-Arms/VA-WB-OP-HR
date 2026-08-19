/* =====================================================
 * view-story.js — 赛事看点挖掘视图
 *
 * Tab 结构：
 *   1. h2h    — 历史对阵（交锋记录、趋势、关键场次）
 *   2. nexus  — 阵容恩怨（选手连线、故事卡片）
 *   3. gen    — 看点生成（自动标签、摘要编辑、状态流转）
 *   4. teams  — 战队库（48队网格、roster 管理）
 * ===================================================== */

/* ---------- 主渲染 ---------- */
App.renderStory = function(){
  App.ui.story = App.ui.story || { tab:'h2h', matchKey:'' };
  const st = App.ui.story;
  const isAdmin = App.can('manage');

  /* 工具栏 */
  const toolbar = `
    <div class="toolbar">
      <div class="tabs">
        <button class="tab ${st.tab==='h2h'?'active':''}" onclick="App.storyTab('h2h')">🆚 历史对阵</button>
        <button class="tab ${st.tab==='nexus'?'active':''}" onclick="App.storyTab('nexus')">🔗 阵容恩怨</button>
        <button class="tab ${st.tab==='gen'?'active':''}" onclick="App.storyTab('gen')">✨ 看点生成</button>
        <button class="tab ${st.tab==='teams'?'active':''}" onclick="App.storyTab('teams')">🏢 战队库</button>
      </div>
      ${st.tab !== 'teams' ? App._storyMatchPicker() : ''}
      ${st.tab !== 'teams' ? `<button class="btn sm" onclick="App.exportImage('看点挖掘_${D.today()}')" title="导出图片">📷</button>` : ''}
    </div>`;

  let body = '';
  if(st.tab === 'h2h')   body = App.renderStoryH2H();
  else if(st.tab === 'nexus') body = App.renderStoryNexus();
  else if(st.tab === 'gen')   body = App.renderStoryGen();
  else if(st.tab === 'teams') body = App.renderStoryTeams();

  const wipBanner = `
    <div class="st-wip">
      <span class="st-wip-tag">WIP</span>
      <span>本模块为开发中版本（Work In Progress）。战队数据/恩怨检测/看点生成均为初始状态，VLR 自动抓取尚未接入线上 workflow，数据可能不完整。</span>
    </div>`;

  return wipBanner + toolbar + body;
};

/* ---------- Tab 切换 ---------- */
App.storyTab = function(t){
  App.ui.story.tab = t;
  App.renderView();
};

/* ---------- 比赛选择器 ---------- */
App._storyMatchPicker = function(){
  const st = App.ui.story;
  const days = App.state.scheduleDays || {};
  const options = [];

  for(const [ds, info] of Object.entries(days)){
    if(info.type !== 'match' || !info.matches || !info.matches.length) continue;
    for(const m of info.matches){
      const key = ds + '|' + m.teams;
      const label = `${D.dateCN(ds)} ${m.time} ${m.teams} (${m.stage})`;
      options.push(`<option value="${key}" ${st.matchKey===key?'selected':''}>${label}</option>`);
    }
  }

  if(!options.length){
    options.push('<option value="">暂无比赛日</option>');
  }

  return `
    <select class="st-picker" onchange="App.storyPickMatch(this.value)">
      <option value="">— 选择比赛 —</option>
      ${options.join('')}
    </select>`;
};

App.storyPickMatch = function(key){
  App.ui.story.matchKey = key || '';
  App.renderView();
};

/* 解析当前选中的比赛 */
App._storyResolveMatch = function(){
  const key = App.ui.story.matchKey;
  if(!key) return null;
  const [date, teamsStr] = key.split('|');
  const [keyA, keyB] = App.findTeamKey(teamsStr);
  if(!keyA ||!keyB) return { date, teamsStr, keyA: null, keyB: null, matchKey: null };
  return { date, teamsStr, keyA, keyB, matchKey: App.matchupKey(keyA, keyB) };
};

/* ---------- Tab 1: 历史对阵 ---------- */
App.renderStoryH2H = function(){
  const m = App._storyResolveMatch();
  if(!m || !m.keyA){
    return `<div class="empty">请上方选择比赛以查看历史对阵数据${m ? `（未能识别战队：${m.teamsStr}）` : ''}</div>`;
  }

  const h2h = App.storyH2H(m.keyA, m.keyB);
  const teams = App.state.teams || {};
  const teamA = teams[m.keyA] || { name: m.keyA, short: m.keyA.toUpperCase() };
  const teamB = teams[m.keyB] || { name: m.keyB, short: m.keyB.toUpperCase() };

  /* 战绩总览 */
  const summary = `
    <div class="st-h2h-summary">
      <div class="st-team-side">
        <div class="st-team-name">${teamA.name}</div>
        <div class="st-team-wins" style="color:var(--ok)">${h2h.wins.a} 胜</div>
        <div class="st-trend">${h2h.form.a.split('').map(r => `<span class="${r==='W'?'w':'l'}">${r}</span>`).join('')}</div>
      </div>
      <div class="st-vs-core">
        <div>${h2h.total}</div>
        <div style="font-size:12px;color:var(--sub)">总交手</div>
      </div>
      <div class="st-team-side">
        <div class="st-team-name">${teamB.name}</div>
        <div class="st-team-wins" style="color:var(--accent2)">${h2h.wins.b} 胜</div>
        <div class="st-trend">${h2h.form.b.split('').map(r => `<span class="${r==='W'?'w':'l'}">${r}</span>`).join('')}</div>
      </div>
    </div>`;

  /* 交锋明细表 */
  let table = '';
  if(h2h.recent.length > 0){
    table = `
      <div class="card">
        <h3 class="card-title">交锋明细（近 ${h2h.recent.length} 场）</h3>
        <table class="st-table">
          <thead><tr><th>日期</th><th>赛事</th><th>轮次</th><th>比分</th><th>胜者</th><th>赛制</th></tr></thead>
          <tbody>
            ${h2h.recent.map(r => `
              <tr>
                <td>${r.date}</td>
                <td>${r.event || '-'}</td>
                <td>${r.stage || '-'}</td>
                <td style="font-family:monospace">${r.score || '-'}</td>
                <td style="color:${r.winner===m.keyA?'var(--ok)':'var(--accent2)'}">${(teams[r.winner]||{}).short || r.winner}</td>
                <td>${r.bo || '-'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } else {
    table = `<div class="hint">两队暂无历史交锋记录。可手动添加或等待 VLR 数据同步。</div>`;
  }

  /* 关键场次 */
  let keySection = '';
  if(h2h.keyMatches.length > 0){
    keySection = `
      <div class="card">
        <h3 class="card-title">⭐ 关键场次回顾</h3>
        ${h2h.keyMatches.map(k => `
          <div class="st-key-match">
            <div class="st-key-date">${k.date} · ${k.event || ''}</div>
            <div class="st-key-score">${k.score || ''} <span class="st-key-bo">${k.bo || ''}</span></div>
            <div class="st-key-winner">胜者：${(teams[k.winner]||{}).name || k.winner}</div>
            <div class="st-key-stage">${k.stage || ''}</div>
          </div>`).join('')}
      </div>`;
  }

  /* 人工备注 */
  const isAdmin = App.can('manage');
  const notesSection = `
    <div class="card">
      <h3 class="card-title">📝 人工备注 ${isAdmin ? `<button class="btn sm" onclick="App.matchupNoteOpen('${m.matchKey}')">+ 添加</button>` : ''}</h3>
      ${(h2h.notes || []).length ? h2h.notes.map(n => `
        <div class="st-note">
          <span class="st-note-text">${n.text}</span>
          ${isAdmin ? `<button class="btn xs" onclick="App.matchupNoteDel('${m.matchKey}','${n.id}')">删除</button>` : ''}
        </div>`).join('') : '<div class="hint">暂无人工备注</div>'}
    </div>`;

  return summary + table + keySection + notesSection;
};

/* ---------- Tab 2: 阵容恩怨 ---------- */
App.renderStoryNexus = function(){
  const m = App._storyResolveMatch();
  if(!m || !m.keyA){
    return `<div class="empty">请上方选择比赛以查看阵容恩怨分析${m ? `（未能识别战队：${m.teamsStr}）` : ''}</div>`;
  }

  const nexus = App.storyNexus(m.keyA, m.keyB);
  const teams = App.state.teams || {};
  const teamA = teams[m.keyA] || { name: m.keyA, short: m.keyA.toUpperCase(), roster: [] };
  const teamB = teams[m.keyB] || { name: m.keyB, short: m.keyB.toUpperCase(), roster: [] };

  /* 阵容对照表 */
  const rosterA = nexus.rosterA.length ? nexus.rosterA : (teamA.roster || []);
  const rosterB = nexus.rosterB.length ? nexus.rosterB : (teamB.roster || []);
  const linkedNames = new Set();
  nexus.links.forEach(l => l.players.forEach(p => linkedNames.add(p)));

  const roleIcon = { duelist:'🔫', initiator:'📡', controller:'💨', sentinel:'🛡️', igl:'🧠' };
  const maxRows = Math.max(rosterA.length, rosterB.length, 5);

  let rosterGrid = `
    <div class="card">
      <h3 class="card-title">阵容对照</h3>
      <div class="st-roster-grid">
        <div class="st-roster-head" style="text-align:center;color:var(--accent)">${teamA.name}</div>
        <div></div>
        <div class="st-roster-head" style="text-align:center;color:var(--accent2)">${teamB.name}</div>`;

  for(let i = 0; i < maxRows; i++){
    const pA = rosterA[i];
    const pB = rosterB[i];
    rosterGrid += `
      <div class="st-player ${pA && linkedNames.has(pA.name) ? 'linked' : ''}">
        ${pA ? `${roleIcon[pA.role]||'🎮'} ${pA.name}<span class="st-flag">${(pA.country||'').toUpperCase()}</span>` : ''}
      </div>
      <div style="text-align:center;color:var(--dim)">—</div>
      <div class="st-player ${pB && linkedNames.has(pB.name) ? 'linked' : ''}">
        ${pB ? `${roleIcon[pB.role]||'🎮'} ${pB.name}<span class="st-flag">${(pB.country||'').toUpperCase()}</span>` : ''}
      </div>`;
  }
  rosterGrid += `</div></div>`;

  /* 恩怨卡片 */
  let linkCards = '';
  if(nexus.links.length > 0){
    linkCards = `
      <div class="card">
        <h3 class="card-title">🔗 恩怨故事（${nexus.links.length} 条）</h3>
        ${nexus.links.map(l => `
          <div class="st-link-card ${l.type}">
            <div class="st-link-type">${({reunion:'昔日队友',revenge:'转会恩怨',compatriot:'同乡对决',duel:'王牌对位',manual:'人工备注'})[l.type] || l.type}</div>
            <div class="st-link-text">${l.text}</div>
          </div>`).join('')}
      </div>`;
  } else {
    linkCards = `<div class="hint">暂未检测到阵容恩怨。可在「战队库」中编辑选手的 formerTeams 字段以启用恩怨检测。</div>`;
  }

  return rosterGrid + linkCards;
};

/* ---------- Tab 3: 看点生成 ---------- */
App.renderStoryGen = function(){
  const highlights = App.state.highlights || [];
  const isAdmin = App.can('manage');
  const m = App._storyResolveMatch();

  /* 生成按钮 */
  let genBar = '';
  if(m && m.keyA){
    genBar = `<button class="btn primary" onclick="App.storyRegen('${m.matchKey}','${m.date}','${m.teamsStr}')">✨ 生成看点</button>`;
  } else {
    genBar = `<span class="hint">请先在上方选择比赛</span>`;
  }

  /* 看点列表 */
  const statusLabels = { draft:'草稿', approved:'已批准', rejected:'已弃用', used:'已采用' };
  const statusColors = { draft:'var(--warn)', approved:'var(--ok)', rejected:'var(--dim)', used:'var(--accent)' };

  let list = '';
  if(highlights.length > 0){
    list = highlights.map(h => `
      <div class="st-hl-card ${h.status}">
        <div class="st-hl-head">
          <span class="st-hl-status ${h.status}" style="color:${statusColors[h.status]}">${statusLabels[h.status]}</span>
          <span class="st-hl-date">${h.date}</span>
          <span class="st-hl-teams">${h.teams}</span>
        </div>
        <h4 class="st-hl-title">${h.title}</h4>
        <div class="st-hl-tags">${(h.tags||[]).map(t => `<span class="st-tag">${t}</span>`).join('')}</div>
        <p class="st-hl-summary">${h.summary}</p>
        <div class="st-hl-actions">
          ${isAdmin ? `
            <button class="btn xs" onclick="App.highlightFormOpen('${h.id}')">✏ 编辑</button>
            ${h.status === 'draft' ? `<button class="btn xs" onclick="App.highlightStatus('${h.id}','approved')" style="color:var(--ok)">✓ 批准</button>` : ''}
            ${h.status === 'approved' ? `<button class="btn xs" onclick="App.highlightToContent('${h.id}')" style="color:var(--accent)">📝 转内容排期</button>` : ''}
            ${h.status !== 'rejected' ? `<button class="btn xs" onclick="App.highlightStatus('${h.id}','rejected')" style="color:var(--dim)">✗ 弃用</button>` : ''}
          ` : ''}
        </div>
      </div>`).join('');
  } else {
    list = `<div class="empty">暂无看点卡片。选择比赛后点击「生成看点」自动创建。</div>`;
  }

  return `
    <div class="toolbar" style="margin-bottom:14px">${genBar}</div>
    ${list}`;
};

/* ---------- Tab 4: 战队库 ---------- */
App.renderStoryTeams = function(){
  const teams = App.state.teams || {};
  const isAdmin = App.can('manage');
  const regions = [
    { id:'cn', label:'CN 中国赛区' },
    { id:'americas', label:'Americas 美洲赛区' },
    { id:'emea', label:'EMEA 欧洲中东非洲' },
    { id:'pacific', label:'Pacific 太平洋赛区' },
    { id:'cn-challenger', label:'CN 挑战者队' }
  ];

  let html = '';
  if(isAdmin){
    html += `<div class="hint" style="margin-bottom:12px">
      <button class="btn sm" onclick="App.storySyncTeams()">⟳ 同步VLR数据</button>
      <span style="margin-left:8px">编辑战队后该队将不再被自动同步覆盖（manual标记）</span>
    </div>`;
  }

  for(const reg of regions){
    const regTeams = Object.values(teams).filter(t => t.region === reg.id);
    if(!regTeams.length) continue;

    html += `<div class="st-region-head">${reg.label}（${regTeams.length} 队）</div>`;
    html += `<div class="st-team-grid">`;

    for(const t of regTeams){
      const rosterCount = (t.roster || []).length;
      const srcBadge = t.manual ? '<span class="st-src-badge" style="background:rgba(229,174,21,.15);color:var(--warn)">手动</span>' :
        rosterCount > 0 ? '<span class="st-src-badge" style="background:rgba(73,255,211,.12);color:var(--ok)">种子</span>' :
        '<span class="st-src-badge" style="background:var(--panel2);color:var(--dim)">空</span>';

      html += `
        <div class="st-team-card">
          <div class="st-team-card-head">
            <span class="st-team-short">${t.short}</span>
            ${srcBadge}
          </div>
          <div class="st-team-fullname">${t.name}</div>
          <div class="st-team-roster-count">${rosterCount} 名选手</div>
          ${isAdmin ? `<button class="btn xs" onclick="App.teamEditOpen('${t.id}')">编辑</button>` : ''}
        </div>`;
    }
    html += `</div>`;
  }

  return html;
};

/* ---------- 交互函数 ---------- */

/* 重新生成看点 */
App.storyRegen = async function(matchKey, date, teamsStr){
  App.toast('正在生成看点…', 'info', 2000);
  await App.storyData(); /* 确保数据已加载 */
  const result = App.storyGenerate(matchKey, date, teamsStr);
  if(result.created > 0){
    App.toast('看点已生成', 'ok');
  } else if(result.skipped > 0){
    App.toast('已存在人工编辑的看点，未覆盖', 'warn');
  } else {
    App.toast('生成完成', 'ok');
  }
  App.renderView();
};

/* 同步 VLR 战队数据 */
App.storySyncTeams = async function(){
  App.toast('正在同步VLR战队数据…', 'info', 3000);
  App._fetchedTeams = null; /* 清除缓存 */
  const data = await App.storyData();
  if(data && data.merged){
    App.toast('战队数据同步完成', 'ok');
  } else {
    App.toast('同步失败，请检查网络或稍后重试', 'err');
  }
  App.renderView();
};

/* ---------- 战队编辑弹窗 ---------- */
App.teamEditOpen = function(teamId){
  const team = (App.state.teams || {})[teamId];
  if(!team) return;

  const roleOptions = ['duelist','initiator','controller','sentinel','igl'];
  const roleLabels = { duelist:'决斗者', initiator:'先锋', controller:'控场', sentinel:'哨位', igl:'指挥' };

  const rosterRows = (team.roster || []).map((p, i) => `
    <div class="st-edit-row" data-idx="${i}">
      <input class="st-edit-name" value="${p.name}" placeholder="选手ID">
      <select class="st-edit-role">
        ${roleOptions.map(r => `<option value="${r}" ${p.role===r?'selected':''}>${roleLabels[r]}</option>`).join('')}
      </select>
      <input class="st-edit-country" value="${p.country||''}" placeholder="国籍" style="width:60px">
      <input class="st-edit-former" value="${(p.formerTeams||[]).join(', ')}" placeholder="前队(逗号分隔)">
      <button class="btn xs" onclick="this.parentElement.remove()">✕</button>
    </div>`).join('');

  App.modal(`编辑战队：${team.name}`, `
    <div class="form-row single">
      <label>战队全名</label>
      <input id="te-name" value="${team.name}">
    </div>
    <div class="form-row">
      <div><label>简称</label><input id="te-short" value="${team.short}"></div>
      <div><label>VLR ID</label><input id="te-vlrid" value="${team.vlrId||''}" placeholder="vlr.gg战队页ID"></div>
    </div>
    <div class="form-row">
      <div><label>别名（逗号分隔）</label><input id="te-aliases" value="${(team.aliases||[]).join(', ')}"></div>
      <div><label>赛区</label>
        <select id="te-region">
          <option value="cn" ${team.region==='cn'?'selected':''}>CN</option>
          <option value="americas" ${team.region==='americas'?'selected':''}>Americas</option>
          <option value="emea" ${team.region==='emea'?'selected':''}>EMEA</option>
          <option value="pacific" ${team.region==='pacific'?'selected':''}>Pacific</option>
          <option value="cn-challenger" ${team.region==='cn-challenger'?'selected':''}>CN挑战者</option>
        </select>
      </div>
    </div>
    <h4 style="margin:14px 0 8px">选手阵容 <button class="btn xs" onclick="App._teamAddRow()">+ 添加选手</button></h4>
    <div id="te-roster">${rosterRows}</div>
  `, `
    <button class="btn" onclick="App.closeModal()">取消</button>
    <button class="btn primary" onclick="App.teamEditSave('${teamId}')">保存</button>
  `);
};

App._teamAddRow = function(){
  const container = document.getElementById('te-roster');
  if(!container) return;
  const div = document.createElement('div');
  div.className = 'st-edit-row';
  div.innerHTML = `
    <input class="st-edit-name" value="" placeholder="选手ID">
    <select class="st-edit-role">
      <option value="duelist">决斗者</option>
      <option value="initiator">先锋</option>
      <option value="controller">控场</option>
      <option value="sentinel">哨位</option>
      <option value="igl">指挥</option>
    </select>
    <input class="st-edit-country" value="" placeholder="国籍" style="width:60px">
    <input class="st-edit-former" value="" placeholder="前队(逗号分隔)">
    <button class="btn xs" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(div);
};

App.teamEditSave = function(teamId){
  const team = App.state.teams[teamId];
  if(!team) return;

  const name = document.getElementById('te-name').value.trim();
  const short = document.getElementById('te-short').value.trim();
  const vlrId = document.getElementById('te-vlrid').value.trim();
  const aliases = document.getElementById('te-aliases').value.split(',').map(s => s.trim()).filter(Boolean);
  const region = document.getElementById('te-region').value;

  /* 从 DOM 读取选手 */
  const rows = document.querySelectorAll('#te-roster .st-edit-row');
  const roster = [];
  rows.forEach((row, i) => {
    const pName = row.querySelector('.st-edit-name').value.trim();
    if(!pName) return;
    const role = row.querySelector('.st-edit-role').value;
    const country = row.querySelector('.st-edit-country').value.trim().toLowerCase();
    const formerTeams = row.querySelector('.st-edit-former').value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    roster.push({
      id: team.roster && team.roster[i] ? team.roster[i].id : ('p-' + pName.toLowerCase().replace(/[^a-z0-9]/g, '')),
      name: pName, country, role, joined: (team.roster && team.roster[i]) ? team.roster[i].joined : '',
      formerTeams, source: 'manual'
    });
  });

  App.pushHistory('story');
  team.name = name;
  team.short = short;
  team.vlrId = vlrId;
  team.aliases = aliases;
  team.region = region;
  team.roster = roster;
  team.manual = true;
  team.updatedAt = Date.now();
  App.save();
  App.closeModal();
  App.toast('战队数据已保存', 'ok');
  App.renderView();
};

/* ---------- 人工备注 ---------- */
App.matchupNoteOpen = function(matchKey){
  App.modal('添加人工备注', `
    <div class="form-row single">
      <label>备注内容</label>
      <textarea id="mn-text" rows="3" placeholder="如：AG 曾在 2025 晋升赛淘汰 EDG"></textarea>
    </div>
    <div class="form-row single">
      <label>类型</label>
      <select id="mn-type">
        <option value="rivalry">恩怨</option>
        <option value="history">历史</option>
        <option value="context">背景</option>
      </select>
    </div>
  `, `
    <button class="btn" onclick="App.closeModal()">取消</button>
    <button class="btn primary" onclick="App.matchupNoteSave('${matchKey}')">保存</button>
  `);
};

App.matchupNoteSave = function(matchKey){
  const text = document.getElementById('mn-text').value.trim();
  if(!text){ App.toast('请输入备注内容', 'err'); return; }
  const type = document.getElementById('mn-type').value;

  App.pushHistory('story');
  if(!App.state.matchups[matchKey]){
    const [a, b] = matchKey.split('-vs-');
    App.state.matchups[matchKey] = { teams: [a, b], history: [], notes: [], updatedAt: 0 };
  }
  App.state.matchups[matchKey].notes.push({
    id: App.uid('M'), type, text,
    addedBy: App.state.user, addedAt: Date.now()
  });
  App.state.matchups[matchKey].updatedAt = Date.now();
  App.save();
  App.closeModal();
  App.toast('备注已添加', 'ok');
  App.renderView();
};

App.matchupNoteDel = function(matchKey, noteId){
  App.pushHistory('story');
  const mu = App.state.matchups[matchKey];
  if(mu && mu.notes){
    mu.notes = mu.notes.filter(n => n.id !== noteId);
    App.save();
    App.toast('备注已删除', 'ok');
    App.renderView();
  }
};

/* ---------- 看点编辑 ---------- */
App.highlightFormOpen = function(id){
  const hl = (App.state.highlights || []).find(h => h.id === id);
  if(!hl) return;

  App.modal('编辑看点', `
    <div class="form-row single">
      <label>标题</label>
      <input id="hl-title" value="${hl.title}">
    </div>
    <div class="form-row single">
      <label>标签（逗号分隔）</label>
      <input id="hl-tags" value="${(hl.tags||[]).join(', ')}">
    </div>
    <div class="form-row single">
      <label>摘要</label>
      <textarea id="hl-summary" rows="6">${hl.summary}</textarea>
    </div>
  `, `
    <button class="btn" onclick="App.closeModal()">取消</button>
    <button class="btn primary" onclick="App.highlightSave('${id}')">保存</button>
  `);
};

App.highlightSave = function(id){
  const hl = (App.state.highlights || []).find(h => h.id === id);
  if(!hl) return;

  const title = document.getElementById('hl-title').value.trim();
  const tags = document.getElementById('hl-tags').value.split(',').map(s => s.trim()).filter(Boolean);
  const summary = document.getElementById('hl-summary').value.trim();

  App.pushHistory('story');
  hl.title = title;
  hl.tags = tags;
  hl.summary = summary;
  hl.edited = true;
  hl.updatedAt = Date.now();
  App.save();
  App.closeModal();
  App.toast('看点已保存', 'ok');
  App.renderView();
};

App.highlightStatus = function(id, status){
  App.pushHistory('story');
  const hl = (App.state.highlights || []).find(h => h.id === id);
  if(hl){
    hl.status = status;
    hl.updatedAt = Date.now();
    App.save();
    App.toast(`看点状态已更新：${{draft:'草稿',approved:'已批准',rejected:'已弃用',used:'已采用'}[status]}`, 'ok');
    App.renderView();
  }
};

/* 看点转内容排期 */
App.highlightToContent = function(id){
  const hl = (App.state.highlights || []).find(h => h.id === id);
  if(!hl) return;

  /* 写入 state.content */
  App.pushHistory('story');
  const content = App.state.content || [];
  const newItem = {
    id: App.uid('C'),
    date: hl.date,
    time: '16:00',
    title: hl.title,
    type: '看点',
    status: 'draft',
    note: hl.summary,
    assigneeId: null
  };
  content.push(newItem);
  App.state.content = content;
  hl.status = 'used';
  hl.updatedAt = Date.now();
  App.save();
  App.toast('已转为内容排期条目，可在「内容排期」页查看', 'ok', 4000);
  App.renderView();
};
