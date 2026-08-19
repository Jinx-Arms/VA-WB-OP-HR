/* =====================================================
 * store.js — 状态管理 + 核心业务逻辑
 * （持久化 / 赛程同步 / 智能排班 / 冲突检测 / 责任分配）
 *
 * 持久化方案：优先走本地服务器磁盘文件（data/state.json），
 * 服务器不可用时自动降级到 localStorage。
 * ===================================================== */
const LS_KEY = 'vct-ops-hr-v1';  // 降级用 localStorage key
const DEFAULT_PWD_HASH = 'b5a557a3cd3d0259f4908630a9df88b081cf9a42a56728371ced9f370460ce5c'; // SHA-256('vct2026')
const App = window.App = { state: null, ui: {}, _serverOK: null, _pendingSave: null };

/* ---------- 密码哈希（浏览器 Web Crypto API） ---------- */
async function sha256(text){
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}

/* ---------- 认证字段迁移（旧数据兼容） ---------- */
function migrateAuth(staff){
  staff.forEach(s => {
    if(!s.username) s.username = s.id.toLowerCase();
    if(!s.passwordHash) s.passwordHash = DEFAULT_PWD_HASH;
  });
}

/* ---------- 种子数据 ---------- */
function seedState(){
  const today = D.today();
  const st = {
    user: null,                       // 当前登录者 staffId
    seq: 100,
    remoteRev: 0,                     // 已同步的官方赛程版本
    lastSync: Date.now(),
    syncLog: [{ time: Date.now(), changes: [], note: '系统初始化：导入 VCT CN 联赛与上海全球冠军赛赛程' }],
    staff: [
      { id:'S1', name:'陈默',  role:'admin',    position:'运营主管', phone:'138-0000-0001', joinDate:'2024-03-01', status:'active', leaveDate:null, username:'s1', passwordHash:DEFAULT_PWD_HASH },
      { id:'S2', name:'林小满', role:'employee', position:'内容运营', phone:'139-0000-0002', joinDate:'2024-06-15', status:'active', leaveDate:null, username:'s2', passwordHash:DEFAULT_PWD_HASH },
      { id:'S3', name:'王锐',  role:'employee', position:'社媒运营', phone:'137-0000-0003', joinDate:'2025-01-10', status:'active', leaveDate:null, username:'s3', passwordHash:DEFAULT_PWD_HASH },
      { id:'S4', name:'周舟',  role:'employee', position:'视频运营', phone:'136-0000-0004', joinDate:'2025-02-20', status:'active', leaveDate:null, username:'s4', passwordHash:DEFAULT_PWD_HASH },
      { id:'S5', name:'苏晴',  role:'employee', position:'社群运营', phone:'135-0000-0005', joinDate:'2025-05-06', status:'active', leaveDate:null, username:'s5', passwordHash:DEFAULT_PWD_HASH },
      { id:'S6', name:'小新',  role:'intern',   position:'运营实习生', phone:'134-0000-0006', joinDate:'2026-07-01', status:'active', leaveDate:null, username:'s6', passwordHash:DEFAULT_PWD_HASH },
      { id:'S7', name:'阿禾',  role:'intern',   position:'运营实习生', phone:'133-0000-0007', joinDate:'2026-08-03', status:'active', leaveDate:null, username:'s7', passwordHash:DEFAULT_PWD_HASH }
    ],
    scheduleDays: calendarAtRev(0),   // date -> {type, manual, matches[]}
    shifts: {},                       // date -> { staffId: 'early'|'late' }
    leave: [
      { id:'L1', staffId:'S3', start: D.addDays(today, 10), end: D.addDays(today, 11), reason:'年假出行', status:'approved', createdAt: Date.now()-86400000*3, decidedBy:'S1', decidedAt: Date.now()-86400000*2, comment:'批准，注意交接' },
      { id:'L2', staffId:'S2', start: D.addDays(today, 5),  end: D.addDays(today, 7),  reason:'家中事务', status:'pending', createdAt: Date.now()-3600000*5, decidedBy:null, decidedAt:null, comment:'' }
    ],
    content: seedContent(),
    notifications: []
  };
  return st;
}

function seedContent(){
  const today = D.today();
  const cal = calendarAtRev(0);
  const arr = [];
  let n = 0;
  const push = (date, time, title, type, status) => {
    arr.push({ id:'C'+(++n), date, time, title, type, status, note:'', assigneeId:null });
  };
  for(let i=-3; i<=10; i++){
    const ds = D.addDays(today, i);
    const info = cal[ds];
    if(!info) continue;
    if(info.type === 'match'){
      push(ds, '15:00', '赛前预热：今日对阵前瞻', '赛前预热', i<0 ? 'published' : 'planned');
      push(ds, '23:30', '赛果战报：今日比赛速递', '赛果战报', i<0 ? 'published' : 'planned');
    } else {
      push(ds, '20:00', '休赛日互动话题：聊聊本周最佳操作', '互动话题', i<0 ? 'published' : 'planned');
    }
  }
  return arr;
}

/* ---------- 持久化 ---------- */

/* 后台异步写入（云端模式 → Supabase，本地模式 → 服务器磁盘 / localStorage） */
App.save = function(){
  if(!App.state) return;
  const json = JSON.stringify(App.state);

  /* 云端模式：写入 Supabase */
  if(CLOUD.isCloudMode()){
    if(App._pendingSave) clearTimeout(App._pendingSave);
    App._pendingSave = setTimeout(() => {
      CLOUD.setState(App.state).then(() => {
        App._serverOK = true;
      }).catch(e => {
        console.warn('[存储] Supabase 保存失败，降级 localStorage:', e.message);
        App._serverOK = false;
        try{ localStorage.setItem(LS_KEY, json); }catch(e2){}
      }).finally(() => { App._pendingSave = null; });
    }, 200);
    return;
  }

  /* 本地模式：服务器不可用时写 localStorage */
  if(App._serverOK === false){
    try{ localStorage.setItem(LS_KEY, json); }catch(e){}
    return;
  }
  // 合并连续 save 请求，避免短时间大量 POST
  if(App._pendingSave) clearTimeout(App._pendingSave);
  App._pendingSave = setTimeout(() => {
    fetch('/api/state', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(App.state)
    }).then(r => { App._serverOK = r.ok; })
      .catch(() => { App._serverOK = false; try{ localStorage.setItem(LS_KEY, json); }catch(e){} })
      .finally(() => { App._pendingSave = null; });
  }, 200);
};

/* 异步加载：云端模式 → Supabase；本地模式 → 服务器磁盘，失败降级 localStorage，都没有则播种 */
App.load = function(){
  /* 云端模式：从 Supabase 加载 */
  if(CLOUD.isCloudMode()){
    return CLOUD.getState().then(remote => {
      if(remote && Object.keys(remote).length > 0){
        App.state = remote;
        App._serverOK = true;
        return;
      }
      App.state = seedState();
      App._serverOK = true;
      const { y, m } = D.ym(D.today());
      App.autoSchedule(y, m, true);
      App.autoAssign(true);
      App.save();
    }).catch(err => {
      console.warn('[存储] Supabase 加载失败，降级 localStorage:', err.message);
      App._serverOK = false;
      try{
        const raw = localStorage.getItem(LS_KEY);
        if(raw){ App.state = JSON.parse(raw); return; }
      }catch(e){ /* 损坏则重建 */ }
      App.state = seedState();
      const { y, m } = D.ym(D.today());
      App.autoSchedule(y, m, true);
      App.autoAssign(true);
      try{ localStorage.setItem(LS_KEY, JSON.stringify(App.state)); }catch(e){}
    });
  }

  /* 本地模式：优先从服务器磁盘读取 */
  return fetch('/api/state').then(r => {
    if(!r.ok) throw new Error('http ' + r.status);
    return r.json();
  }).then(remote => {
    if(remote && Object.keys(remote).length > 0){
      App.state = remote;
      App._serverOK = true;
      return;
    }
    // 服务器返回空（首次启动）→ 播种
    App.state = seedState();
    App._serverOK = true;
    const { y, m } = D.ym(D.today());
    App.autoSchedule(y, m, true);
    App.autoAssign(true);
    App.save();
  }).catch(() => {
    // 服务器不可用 → 降级 localStorage
    App._serverOK = false;
    try{
      const raw = localStorage.getItem(LS_KEY);
      if(raw){ App.state = JSON.parse(raw); return; }
    }catch(e){ /* 损坏则重建 */ }
    App.state = seedState();
    const { y, m } = D.ym(D.today());
    App.autoSchedule(y, m, true);
    App.autoAssign(true);
    try{ localStorage.setItem(LS_KEY, JSON.stringify(App.state)); }catch(e){}
  });
};

/* 页面关闭前强制刷写（尽力而为） */
App.flush = function(){
  if(App._pendingSave){
    clearTimeout(App._pendingSave);
    App._pendingSave = null;
  }
  if(!App.state) return;

  /* 云端模式：fetch keepalive 刷写 Supabase */
  if(CLOUD.isCloudMode()){
    CLOUD.setStateBeacon(App.state);
    return;
  }

  const json = JSON.stringify(App.state);
  if(App._serverOK === false){
    try{ localStorage.setItem(LS_KEY, json); }catch(e){}
    return;
  }
  // 同步 Beacon 发送（页面关闭时仍可靠）
  try{
    navigator.sendBeacon('/api/state', new Blob([json], { type:'application/json' }));
  }catch(e){
    try{ localStorage.setItem(LS_KEY, json); }catch(e2){}
  }
};

/* ---------- 基础工具 ---------- */
App.uid = function(prefix){ return prefix + (++App.state.seq); };
App.me = function(){ return App.state.user ? App.staffById(App.state.user) : null; };
App.staffById = function(id){ return App.state.staff.find(s => s.id === id) || null; };
App.can = function(perm){
  const me = App.me();
  if(!me) return false;
  if(perm === 'manage') return me.role === 'admin';
  return true;
};
App.onApprovedLeave = function(staffId, date){
  return App.state.leave.some(l =>
    l.staffId === staffId && l.status === 'approved' && date >= l.start && date <= l.end);
};
App.leaveCovering = function(staffId, date){
  return App.state.leave.find(l =>
    l.staffId === staffId && l.status !== 'rejected' && date >= l.start && date <= l.end) || null;
};
App.dayType = function(date){
  const info = App.state.scheduleDays[date];
  return info ? info.type : 'rest';
};

/* ---------- 通知 ---------- */
App.notify = function(userId, text){
  App.state.notifications.unshift({ id: App.uid('N'), userId, text, time: Date.now(), read: false });
  if(App.state.notifications.length > 200) App.state.notifications.length = 200;
};
App.unreadCount = function(){
  const uid = App.state.user;
  return App.state.notifications.filter(n => n.userId === uid && !n.read).length;
};

/* ---------- 赛程同步（官方接口 → 本地） ----------
 * 手动修正（manual=true）优先，不会被同步覆盖；
 * 同步后受影响的已排班日会记入日志，提示管理员重排。
 */
App.syncSchedule = function(){
  return new Promise(resolve => {
    const prevRev = App.state.remoteRev;
    const nextRev = prevRev + 1;
    fetchRemoteSchedule(nextRev).then(remote => {
      const st = App.state;
      const changes = [];
      for(const ds of Object.keys(remote.days)){
        const cur = st.scheduleDays[ds];
        const rem = remote.days[ds];
        if(cur && cur.manual) continue;                       // 手动修正优先
        if(!cur){
          st.scheduleDays[ds] = rem;
          changes.push({ date: ds, desc: '新增赛程' });
        } else if(cur.type !== rem.type || JSON.stringify(cur.matches) !== JSON.stringify(rem.matches)){
          st.scheduleDays[ds] = rem;
          changes.push({ date: ds, desc:
            cur.type === 'match' && rem.type === 'rest' ? '比赛日 → 休赛日' :
            cur.type === 'rest' && rem.type === 'match' ? '休赛日 → 比赛日' : '比赛场次/时间调整' });
        }
      }
      st.remoteRev = nextRev;
      st.lastSync = Date.now();
      const affected = changes.filter(c => st.shifts[c.date] && Object.keys(st.shifts[c.date]).length);
      const syncNote = remote.source === 'vlr'
        ? 'VLR 赛程同步' + (remote.fetchedAt ? '（' + remote.fetchedAt.slice(0,16).replace('T',' ') + '）' : '')
        : (OFFICIAL_CHANGES[prevRev] ? OFFICIAL_CHANGES[prevRev].desc : '本地模拟同步');
      st.syncLog.unshift({ time: Date.now(), changes, affected: affected.length, note: syncNote, source: remote.source || 'mock' });
      if(st.syncLog.length > 30) st.syncLog.length = 30;
      App.save();
      resolve({ changes, affected });
    });
  });
};

/* ---------- 智能排班 ----------
 * 规则：比赛日 4 人值守、休赛日 2 人；已批准休假者不排；
 * 按累计班次均衡轮转；连续工作超 5 天尽量回避；早/晚班交替分配。
 */
App.autoSchedule = function(y, m, silent){
  const st = App.state;
  const days = D.monthDays(y, m);
  const active = st.staff.filter(s => s.status === 'active');
  const counts = {};    // 本月累计班次（均衡用）
  const streak = {};    // 连续工作天数
  for(const day of days){
    const type = App.dayType(day);
    const avail = active.filter(s => !App.onApprovedLeave(s.id, day));
    // 连续工作 >5 天者尽量回避
    let pool = avail.filter(s => (streak[s.id] || 0) < 5);
    if(pool.length < 2) pool = avail;
    const need = Math.min(type === 'match' ? 4 : 2, pool.length);
    pool.sort((a, b) => (counts[a.id] || 0) - (counts[b.id] || 0));
    const picked = pool.slice(0, need);
    const map = {};
    picked.forEach((s, i) => {
      let sh = i % 2 === 0 ? 'early' : 'late';
      const prev = (st.shifts[D.addDays(day, -1)] || {})[s.id];
      if(prev === sh) sh = sh === 'early' ? 'late' : 'early';   // 与前一日同班则对调
      map[s.id] = sh;
      counts[s.id] = (counts[s.id] || 0) + 1;
      streak[s.id] = (streak[s.id] || 0) + 1;
    });
    // 未被选中者连续工作清零
    active.forEach(s => { if(!map[s.id]) streak[s.id] = 0; });
    st.shifts[day] = map;
  }
  if(!silent) App.save();
};

/* ---------- 冲突检测 ---------- */
App.detectConflicts = function(y, m){
  const st = App.state;
  const list = [];
  const days = D.monthDays(y, m);
  const name = id => (App.staffById(id) ? App.staffById(id).name : '未知成员');
  for(const day of days){
    const working = st.shifts[day] || {};
    const ids = Object.keys(working);
    for(const sid of ids){
      const s = App.staffById(sid);
      if(!s || s.status !== 'active'){
        list.push({ level:'error', text: `${D.dateCN(day)}：${name(sid)} 已离职/不存在，但仍排在班表中` });
      } else if(App.onApprovedLeave(sid, day)){
        list.push({ level:'error', text: `${D.dateCN(day)}：${s.name} 已批准休假，但仍排有${working[sid] === 'early' ? '早' : '晚'}班` });
      }
    }
    const type = App.dayType(day);
    if(type === 'match' && ids.length < 4 && day >= D.today())
      list.push({ level:'warn', text: `${D.dateCN(day)}（比赛日）人力不足：现 ${ids.length} 人，建议 4 人` });
    if(type === 'rest' && ids.length === 0 && day >= D.today())
      list.push({ level:'warn', text: `${D.dateCN(day)}（休赛日）无人值守` });
  }
  // 内容任务检查
  st.content.filter(c => days.indexOf(c.date) >= 0 && c.status !== 'cancelled').forEach(c => {
    if(!c.assigneeId){
      list.push({ level:'warn', text: `${D.dateCN(c.date)} 内容《${c.title}》尚未分配负责人` });
      return;
    }
    const a = App.staffById(c.assigneeId);
    if(!a || a.status !== 'active'){
      list.push({ level:'error', text: `${D.dateCN(c.date)}《${c.title}》负责人已离职，需重新分配` });
    } else if(a.role === 'intern'){
      list.push({ level:'error', text: `${D.dateCN(c.date)}《${c.title}》负责人为实习生，实习生不能承担内容发布任务` });
    } else if(!(st.shifts[c.date] || {})[c.assigneeId]){
      list.push({ level:'warn', text: `${D.dateCN(c.date)}《${c.title}》负责人 ${a.name} 当天不在班，建议调整` });
    }
  });
  return list;
};

/* ---------- 责任自动分配 ----------
 * 内容发布任务只分配给当天当班、在职、非实习生的成员，按任务量均衡。
 */
App.autoAssign = function(silent){
  const st = App.state;
  const today = D.today();
  const items = st.content
    .filter(c => c.date >= today && c.status !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date));
  const load = {};
  let changed = 0;
  for(const c of items){
    const duty = Object.keys(st.shifts[c.date] || {}).filter(id => {
      const s = App.staffById(id);
      return s && s.status === 'active' && s.role !== 'intern';   // 实习生不承担发布任务
    });
    if(!duty.length){
      if(c.assigneeId){ c.assigneeId = null; changed++; }
      continue;
    }
    duty.sort((a, b) => (load[a] || 0) - (load[b] || 0));
    const pick = duty[0];
    if(c.assigneeId !== pick){
      c.assigneeId = pick;
      changed++;
      if(!silent) App.notify(pick, `你被分配负责 ${D.dateCN(c.date)}《${c.title}》（${c.type}），请按时发布`);
    }
    load[pick] = (load[pick] || 0) + 1;
  }
  if(!silent) App.save();
  return { total: items.length, changed };
};

/* ---------- CSV 导出（带 BOM，Excel 友好） ---------- */
App.exportCSV = function(filename, rows){
  const csv = '\ufeff' + rows.map(r =>
    r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')
  ).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
};
