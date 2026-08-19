/* =====================================================
 * main.js — 登录 / 权限路由 / 通知中心 / 仪表盘 / 启动
 * ===================================================== */

/* ---------- 弹窗 & 轻提示 ---------- */
App.modal = function(title, bodyHTML, footHTML){
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal">
    <div class="modal-head"><h3>${title}</h3><button class="icon-btn" onclick="App.closeModal()">✕</button></div>
    <div class="modal-body">${bodyHTML}</div>
    ${footHTML ? `<div class="modal-foot">${footHTML}</div>` : ''}
  </div>`;
  wrap.addEventListener('click', e => { if(e.target === wrap) App.closeModal(); });
  document.body.appendChild(wrap);
};
App.closeModal = function(){ document.querySelectorAll('.modal-wrap').forEach(e => e.remove()); };
App.toast = function(msg, type = 'info', ms = 3000){
  const t = document.createElement('div');
  t.className = 'toast ' + (type === 'info' ? '' : type);
  t.textContent = msg;
  let box = document.getElementById('toasts');
  if(!box){ box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  box.appendChild(t);
  setTimeout(() => t.remove(), ms);
};

/* ---------- 主题切换 ---------- */
App.applyTheme = function(){
  const t = localStorage.getItem('vct-theme') || 'dark';
  document.documentElement.dataset.theme = t;
  const icon = document.getElementById('theme-icon');
  if(icon) icon.textContent = t === 'light' ? '🌙' : '☀️';
};
App.toggleTheme = function(){
  const cur = localStorage.getItem('vct-theme') || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  localStorage.setItem('vct-theme', next);
  document.documentElement.dataset.theme = next;
  const icon = document.getElementById('theme-icon');
  if(icon) icon.textContent = next === 'light' ? '🌙' : '☀️';
  App.toast(next === 'light' ? '已切换到亮色主题' : '已切换到深色主题', 'info', 1800);
};

/* ---------- 登录（账号密码模式） ---------- */
const AVATAR_COLORS = ['#DC3030','#6305A0','#0D9093','#20488E','#6F4ACC','#E5AE15','#FD2659'];
function avatarColor(id){
  const i = (id || 'x').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[i % AVATAR_COLORS.length];
}
function avatarHTML(s, size){
  return `<div class="avatar" style="background:${avatarColor(s.id)};width:${size||28}px;height:${size||28}px">${s.name.slice(0,1)}</div>`;
}

App.renderLogin = function(){
  const ti = (localStorage.getItem('vct-theme')||'dark')==='light' ? '🌙' : '☀️';
  document.getElementById('app').innerHTML = `
  <div class="login-wrap">
    <button class="theme-toggle" style="position:fixed;top:18px;right:18px" onclick="App.toggleTheme()" title="切换亮色/深色主题"><span id="theme-icon">${ti}</span></button>
    <div class="login-logo">瓦电 <b>赛事运营中台</b></div>
    <div class="login-sub">${LEAGUE} · 官方运营账号人员管理系统</div>
    <div class="login-form">
      <div class="login-field">
        <label>用户名</label>
        <input id="login-user" type="text" placeholder="请输入用户名" autocomplete="username"
          onkeydown="if(event.key==='Enter'){event.preventDefault();document.getElementById('login-pwd').focus()}">
      </div>
      <div class="login-field">
        <label>密码</label>
        <input id="login-pwd" type="password" placeholder="请输入密码" autocomplete="current-password"
          onkeydown="if(event.key==='Enter'){event.preventDefault();App.doLogin()}">
      </div>
      <button class="login-btn" onclick="App.doLogin()">登 录</button>
      <div class="login-tip">首次登录默认密码：vct2026　·　登录后请及时修改密码</div>
    </div>
  </div>`;
  setTimeout(() => { const el = document.getElementById('login-user'); if(el) el.focus(); }, 100);
};

App.doLogin = async function(){
  const username = document.getElementById('login-user').value.trim().toLowerCase();
  const password = document.getElementById('login-pwd').value;
  if(!username || !password){ App.toast('请输入用户名和密码', 'err'); return; }

  const staff = App.state.staff.find(s => s.username === username && s.status === 'active');
  if(!staff){
    App.toast('用户名不存在或已停用', 'err');
    return;
  }

  const hash = await sha256(password);
  if(hash !== staff.passwordHash){
    App.toast('密码错误', 'err');
    return;
  }

  /* 登录成功 */
  App.state.user = staff.id;
  App.save();
  App.ui = { rosterTab:'grid', roster:{ mode:'month', ref: D.today() } };
  App.renderShell();
  App.nav(App.can('manage') ? 'dash' : 'mine');
  // 超 24 小时自动同步一次官方赛程
  if(Date.now() - (App.state.lastSync || 0) > 86400000 && App.can('manage')){
    App.syncSchedule().then(({ changes, affected }) => {
      if(changes.length){
        App.toast(`官方赛程有 ${changes.length} 项更新：` + changes.map(c => D.dateCN(c.date) + c.desc).join('；'), 'ok', 6000);
        if(affected.length) App.toast(`⚠️ ${affected.length} 个已排班日受影响，建议重新排班`, 'warn', 6000);
        App.renderView();
      }
    });
  }
};

/* ---------- 修改密码 ---------- */
App.changePasswordOpen = function(){
  App.closeUserMenu();
  App.modal('修改密码', `
    <div class="form-row single"><label>当前密码</label><input type="password" id="cp-old" placeholder="请输入当前密码" autocomplete="current-password"></div>
    <div class="form-row">
      <div><label>新密码</label><input type="password" id="cp-new" placeholder="至少 6 位" autocomplete="new-password"></div>
      <div><label>确认新密码</label><input type="password" id="cp-confirm" placeholder="再次输入新密码" autocomplete="new-password"></div>
    </div>
  `, `
    <button class="btn" onclick="App.closeModal()">取消</button>
    <button class="btn primary" onclick="App.changePasswordConfirm()">确认修改</button>
  `);
  setTimeout(() => { const el = document.getElementById('cp-old'); if(el) el.focus(); }, 100);
};

App.changePasswordConfirm = async function(){
  const me = App.me();
  const oldPwd = document.getElementById('cp-old').value;
  const newPwd = document.getElementById('cp-new').value;
  const confirmPwd = document.getElementById('cp-confirm').value;

  if(!oldPwd || !newPwd || !confirmPwd){ App.toast('请填写完整', 'err'); return; }
  if(newPwd.length < 6){ App.toast('新密码至少 6 位', 'err'); return; }
  if(newPwd !== confirmPwd){ App.toast('两次输入的新密码不一致', 'err'); return; }

  const oldHash = await sha256(oldPwd);
  if(oldHash !== me.passwordHash){ App.toast('当前密码错误', 'err'); return; }

  const newHash = await sha256(newPwd);
  me.passwordHash = newHash;
  App.save();
  App.closeModal();
  App.toast('密码修改成功', 'ok');
};

/* ---------- 用户菜单 ---------- */
App.toggleUserMenu = function(){
  const menu = document.getElementById('user-menu');
  if(menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
};
App.closeUserMenu = function(){
  const menu = document.getElementById('user-menu');
  if(menu) menu.style.display = 'none';
};

App.logout = function(){
  App.closeUserMenu();
  App.state.user = null;
  App.save();
  App.closeModal();
  App.renderLogin();
};

/* ---------- 框架 & 路由 ---------- */
const NAV = [
  { key:'dash',    label:'运营概览',    ico:'📊', admin:true },
  { key:'schedule',label:'赛程日历',    ico:'📅' },
  { key:'roster',  label:'排班管理',    ico:'🗓️', admin:true },
  { key:'staff',   label:'人员管理',    ico:'👥', admin:true },
  { key:'content', label:'内容排期',    ico:'📝' },
  { key:'assign',  label:'责任分配',    ico:'🎯', admin:true },
  { key:'mine',    label:'我的面板',    ico:'🙋', hideForAdmin:false }
];

App.renderShell = function(){
  const me = App.me();
  if(!me){ App.renderLogin(); return; }
  const unread = App.unreadCount();
  document.getElementById('app').innerHTML = `
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">瓦电运营中台<small>赛事人员管理系统 v1.0</small></div>
      <nav class="nav">
        ${NAV.filter(n => !n.admin || App.can('manage')).map(n => `
          <div class="nav-item" id="nav-${n.key}" onclick="App.nav('${n.key}')">
            <span class="ico">${n.ico}</span>${n.label}
          </div>`).join('')}
      </nav>
      <div class="side-foot">${LEAGUE}<br>数据磁盘持久化 · 服务器托管</div>
    </aside>
    <div class="main">
      <header class="topbar">
        <h1 id="page-title"></h1>
        <div style="position:relative">
          <button class="bell" onclick="App.toggleBell()">🔔${unread ? `<span class="dot">${unread}</span>` : ''}</button>
          <div id="bell-panel" style="display:none"></div>
        </div>
        <span id="storage-indicator" class="storage-indicator" title="数据存储状态"></span>
        <button class="theme-toggle" onclick="App.toggleTheme()" title="切换亮色/深色主题"><span id="theme-icon">${(localStorage.getItem('vct-theme')||'dark')==='light'?'🌙':'☀️'}</span></button>
        <div class="user-chip-wrap">
          <div class="user-chip" onclick="App.toggleUserMenu()" title="账户操作">
            ${avatarHTML(me)}<span>${me.name} · ${roleCN(me.role)}</span>
          </div>
          <div id="user-menu" class="user-menu" style="display:none">
            <div class="user-menu-item" onclick="App.changePasswordOpen()">🔑 修改密码</div>
            <div class="user-menu-item danger" onclick="App.logout()">🚪 退出登录</div>
          </div>
        </div>
      </header>
      <main class="content" id="view"></main>
    </div>
  </div>`;
};

/* ---------- 存储状态指示器 ---------- */
App.updateStorageIndicator = function(){
  const el = document.getElementById('storage-indicator');
  if(!el) return;
  if(CLOUD.isCloudMode()){
    el.textContent = '☁️';
    el.title = '云端模式：数据同步到 Supabase';
    el.className = 'storage-indicator ok';
  } else if(App._serverOK === true){
    el.textContent = '💾';
    el.title = '已连接服务器：数据持久化到磁盘';
    el.className = 'storage-indicator ok';
  } else if(App._serverOK === false){
    el.textContent = '⚠️';
    el.title = '服务器未运行！数据仅存于当前浏览器，换浏览器/清缓存将丢失。请启动 server.js';
    el.className = 'storage-indicator warn';
  } else {
    el.textContent = '⏳';
    el.title = '正在连接服务器…';
    el.className = 'storage-indicator';
  }
};

App.nav = function(key){
  // 权限保护
  const item = NAV.find(n => n.key === key);
  if(item && item.admin && !App.can('manage')) key = 'mine';
  App.currentView = key;
  document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
  const el = document.getElementById('nav-' + key);
  if(el) el.classList.add('active');
  const title = document.getElementById('page-title');
  if(title) title.textContent = (NAV.find(n => n.key === key) || {}).label || '';
  App.renderView();
};

App.renderView = function(){
  const me = App.me();
  if(!me){ App.renderLogin(); return; }
  const v = document.getElementById('view');
  if(!v) return;
  App.closeModal();
  if(App.currentView === 'dash') v.innerHTML = App.renderDash();
  else if(App.currentView === 'schedule') v.innerHTML = App.renderSchedule();
  else if(App.currentView === 'roster') v.innerHTML = App.renderRoster();
  else if(App.currentView === 'staff') v.innerHTML = App.renderStaff();
  else if(App.currentView === 'content') v.innerHTML = App.renderContent();
  else if(App.currentView === 'assign') v.innerHTML = App.renderAssign();
  else if(App.currentView === 'mine') v.innerHTML = App.renderMine();
  else v.innerHTML = App.renderDash();
};

/* ---------- 通知中心 ---------- */
App.toggleBell = function(){
  const panel = document.getElementById('bell-panel');
  if(panel.style.display === 'none'){
    const mine = App.state.notifications.filter(n => n.userId === App.state.user).slice(0, 30);
    panel.innerHTML = `
      <h4>通知 <button class="btn sm" onclick="App.readAll()">全部已读</button></h4>
      ${mine.length ? mine.map(n => `
        <div class="notif ${n.read ? '' : 'unread'}">${n.text}<time>${new Date(n.time).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</time></div>`).join('')
        : '<div class="empty">暂无通知</div>'}`;
    panel.style.display = 'block';
    // 标记已读
    App.state.notifications.forEach(n => { if(n.userId === App.state.user) n.read = true; });
    App.save();
    setTimeout(() => { const bell = document.querySelector('.bell'); if(bell){ const dot = bell.querySelector('.dot'); if(dot) dot.remove(); } }, 100);
  } else {
    panel.style.display = 'none';
  }
};
App.readAll = function(){
  App.state.notifications.forEach(n => { if(n.userId === App.state.user) n.read = true; });
  App.save();
  App.toggleBell(); App.toggleBell();
};

/* ---------- 管理员仪表盘 ---------- */
App.renderDash = function(){
  const st = App.state;
  const today = D.today();
  const active = st.staff.filter(s => s.status === 'active');
  const { y, m } = D.ym(today);
  const monthMatchDays = D.monthDays(y, m).filter(ds => App.dayType(ds) === 'match').length;
  const pending = st.leave.filter(l => l.status === 'pending').length;
  const unassigned = st.content.filter(c => c.date >= today && !c.assigneeId && c.status !== 'cancelled').length;
  const conflicts = App.detectConflicts(y, m).filter(c => c.level === 'error').length;

  // 近期比赛日
  const upcoming = [];
  for(let ds = today; upcoming.length < 5 && ds <= '2026-09-30'; ds = D.addDays(ds, 1)){
    const info = st.scheduleDays[ds];
    if(info && info.type === 'match') upcoming.push({ ds, info });
  }
  const todayInfo = st.scheduleDays[today];
  const myShift = (st.shifts[today] || {})[st.user];

  return `
  <div class="stats">
    <div class="stat"><div class="num">${active.length}</div><div class="lbl">在职成员（正式 ${active.filter(s=>s.role!=='intern').length} · 实习生 ${active.filter(s=>s.role==='intern').length}）</div></div>
    <div class="stat"><div class="num" style="color:var(--match)">${monthMatchDays}</div><div class="lbl">本月比赛日（共 ${D.monthDays(y,m).length} 天）</div></div>
    <div class="stat"><div class="num" style="color:${pending ? 'var(--warn)' : 'var(--ok)'}">${pending}</div><div class="lbl">待审批休假申请</div></div>
    <div class="stat"><div class="num" style="color:${unassigned ? 'var(--warn)' : 'var(--ok)'}">${unassigned}</div><div class="lbl">未分配内容任务</div></div>
    <div class="stat"><div class="num" style="color:${conflicts ? 'var(--danger)' : 'var(--ok)'}">${conflicts}</div><div class="lbl">本月排班冲突</div></div>
  </div>
  <div class="dash-cols">
    <div class="card">
      <h3><span class="left">近期比赛（未来 5 个比赛日）</span><span class="hint">数据源：官方赛程 · ${fmtSyncTime(st.lastSync)} 同步</span></h3>
      ${upcoming.length ? upcoming.map(u => `
        <div class="match-row">
          <span class="when">${u.ds} 周${D.weekdayCN(u.ds)}</span>
          <span class="vs">${u.info.matches.map(mt => mt.time + ' ' + mt.teams).join(' ／ ')}</span>
          <span class="stage">${u.info.matches[0] ? u.info.matches[0].stage : ''} ${u.info.manual ? '<span class="badge manual">手动</span>' : ''}</span>
        </div>`).join('') : '<div class="empty">近期无比赛</div>'}
    </div>
    <div>
      <div class="card">
        <h3><span class="left">今日状态</span></h3>
        <div class="day-line"><span class="dt">${today} 周${D.weekdayCN(today)}</span>
          ${todayInfo && todayInfo.type === 'match' ? '<span class="badge match">比赛日</span>' : '<span class="badge rest">休赛日</span>'}
          <span style="margin-left:auto"><span class="shift-tag ${myShift || 'off'}">${myShift === 'early' ? '早班' : myShift === 'late' ? '晚班' : '休息'}</span></span>
        </div>
        ${(todayInfo && todayInfo.matches || []).map(mt => `
          <div class="match-row"><span class="when">${mt.time}</span><span class="vs">${mt.teams}</span><span class="stage">${mt.stage}</span></div>`).join('')}
        <div class="hint" style="margin-top:8px">今日当班：${Object.keys(st.shifts[today] || {}).map(id => { const s = App.staffById(id); return s ? s.name : ''; }).filter(Boolean).join('、') || '无人排班'}</div>
      </div>
      <div class="card">
        <h3><span class="left">快捷操作</span></h3>
        <div class="toolbar">
          <button class="btn" onclick="App.nav('schedule')">📅 同步官方赛程</button>
          <button class="btn" onclick="App.nav('roster')">⚡ 一键智能排班</button>
          <button class="btn" onclick="App.nav('assign')">🎯 智能分配内容</button>
          <button class="btn" onclick="App.ui.rosterTab='leave';App.nav('roster')">✅ 审批休假</button>
        </div>
        <div class="hint">建议流程：同步赛程 → 一键排班 → 冲突检测 → 智能分配内容 → 通知成员</div>
      </div>
    </div>
  </div>`;
};

/* ---------- 启动 ---------- */
App.init = function(){
  // 显示加载占位
  document.getElementById('app').innerHTML = `
    <div class="loading-screen">
      <div class="loading-spinner"></div>
      <div class="loading-text">正在加载数据…</div>
    </div>`;
  App.load().then(() => {
    // 旧数据迁移：补认证字段，有改动则立即持久化
    if(App.state && App.state.staff){
      if(migrateAuth(App.state.staff)) App.save();
    }
    if(App.state.user && App.staffById(App.state.user) && App.staffById(App.state.user).status === 'active'){
      App.renderShell();
      App.nav(App.can('manage') ? 'dash' : 'mine');
    } else {
      App.renderLogin();
    }
    // 服务器不可用时警告（非云端模式）
    if(!CLOUD.isCloudMode() && App._serverOK === false){
      setTimeout(() => {
        App.toast('⚠️ 服务器未运行，数据仅存于当前浏览器！请先启动 server.js 再使用', 'warn', 8000);
      }, 500);
    }
  });
};

/* 页面关闭前强制刷写磁盘 */
window.addEventListener('beforeunload', () => { App.flush(); });

App.init();
