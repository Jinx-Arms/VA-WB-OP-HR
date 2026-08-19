/* =====================================================
 * view-roster.js — 排班管理（周/月视图 + 休假审批 + 冲突检测）
 * ===================================================== */

App.renderRoster = function(){
  const tab = App.ui.rosterTab || 'grid';
  App.ui.roster = App.ui.roster || { mode:'month', ref: D.today() };
  let body = '';
  if(tab === 'grid') body = rosterGrid();
  else if(tab === 'leave') body = leavePanel();
  else body = conflictPanel();
  return `
  <div class="tabs">
    <div class="tab ${tab==='grid'?'active':''}" onclick="App.ui.rosterTab='grid';App.renderView()">排班总览</div>
    <div class="tab ${tab==='leave'?'active':''}" onclick="App.ui.rosterTab='leave';App.renderView()">休假审批${pendingLeaveCount() ? ` <span class="badge st-pending">${pendingLeaveCount()}</span>` : ''}</div>
    <div class="tab ${tab==='conflict'?'active':''}" onclick="App.ui.rosterTab='conflict';App.renderView()">冲突检测</div>
  </div>${body}`;
};

function pendingLeaveCount(){
  return App.state.leave.filter(l => l.status === 'pending').length;
}

/* ---------- 排班总览 ---------- */
function rosterGrid(){
  const st = App.state;
  const r = App.ui.roster;
  let days, title;
  if(r.mode === 'week'){
    const mon = D.addDays(r.ref, -((D.parse(r.ref).getDay() + 6) % 7));
    days = []; for(let i=0;i<7;i++) days.push(D.addDays(mon, i));
    title = mon.slice(5).replace('-','/') + ' 当周';
  } else {
    const { y, m } = D.ym(r.ref);
    days = D.monthDays(y, m);
    title = y + ' 年 ' + m + ' 月';
  }
  const rows = st.staff.filter(s => s.status === 'active' || App.ui.showLeft);
  const isAdmin = App.can('manage');
  const shiftTypes = App.getShiftTypes();
  const shiftMap = {};
  shiftTypes.forEach(t => { shiftMap[t.key] = t; });

  const head = days.map(ds => {
    const t = App.dayType(ds);
    const manual = st.scheduleDays[ds] && st.scheduleDays[ds].manual;
    return `<th><div class="dnum">${D.parse(ds).getMonth()+1}/${D.parse(ds).getDate()}</div>
      <div class="dty">${'一二三四五六日'[(D.parse(ds).getDay()+6)%7]}</div>
      <div class="dty">${t==='match' ? '<span style="color:var(--match)">赛</span>' : '<span style="color:var(--rest)">休</span>'}${manual?'<span style="color:var(--warn)">·</span>':''}</div></th>`;
  }).join('');

  const body = rows.map(s => {
    const cells = days.map(ds => {
      const sh = (st.shifts[ds] || {})[s.id];
      const lv = App.onApprovedLeave(s.id, ds);
      let cls = 'cell', txt = '·', style = '';
      if(lv){ cls += ' leave-cell'; txt = '假'; }
      else if(sh && shiftMap[sh]){
        const t = shiftMap[sh];
        cls += ' editable';
        txt = t.short;
        style = `style="color:${t.color};background:${t.bg};font-weight:700"`;
      }
      if(isAdmin && s.status === 'active' && !lv) cls += ' editable';
      const click = isAdmin && s.status === 'active' ? `onclick="App.cycleShift('${ds}','${s.id}')"` : '';
      const tip = lv ? '休假中（点击可临时加班）' : (sh && shiftMap[sh]) ? shiftMap[sh].label + '（点击调整）' : '休息（点击排班）';
      return `<td class="${cls}" ${style} title="${s.name} ${D.dateCN(ds)}：${tip}" ${click}>${txt}</td>`;
    }).join('');
    return `<tr class="${s.status==='left'?'left':''}"><td class="name-col">${s.name} <span class="badge role-${s.role}">${roleCN(s.role)}</span></td>${cells}</tr>`;
  }).join('');

  return `
  <div class="card">
    <div class="toolbar">
      ${isAdmin ? `<div class="undo-group">
        <button class="btn sm" onclick="App.undoRoster()" ${!App.canUndo('roster')?'disabled':''} title="撤销上次操作">↶ 撤销</button>
        <button class="btn sm" onclick="App.redoRoster()" ${!App.canRedo('roster')?'disabled':''} title="重做">↷ 重做</button>
        <button class="btn sm" onclick="App.resetRoster()" ${!App.canReset('roster')?'disabled':''} title="重置到进入页面时的状态">↺ 重置</button>
      </div>
      <button class="btn sm danger" onclick="App.clearRoster()" title="清空当前时段全部排班">🗑 清空</button>
      <button class="btn sm" onclick="App.shiftTypesOpen()" title="管理班次类型（名称/时间/颜色）">⚙ 班次设置</button>` : ''}
      <div class="tabs" style="margin:0">
        <div class="tab ${r.mode==='month'?'active':''}" onclick="App.ui.roster.mode='month';App.renderView()">月视图</div>
        <div class="tab ${r.mode==='week'?'active':''}" onclick="App.ui.roster.mode='week';App.renderView()">周视图</div>
      </div>
      ${r.mode==='month'
        ? `<input type="month" value="${r.ref.slice(0,7)}" style="width:150px" onchange="App.ui.roster.ref=this.value+'-01';App.renderView()">`
        : `<button class="btn sm" onclick="App.ui.roster.ref=D.addDays(App.ui.roster.ref,-7);App.renderView()">‹ 上周</button>
           <span class="muted" style="padding:0 6px">${title}</span>
           <button class="btn sm" onclick="App.ui.roster.ref=D.addDays(App.ui.roster.ref,7);App.renderView()">下周 ›</button>
           <button class="btn sm" onclick="App.ui.roster.ref=D.today();App.renderView()">本周</button>`}
      <div class="spacer"></div>
      <button class="btn" onclick="App.ui.showLeft=!App.ui.showLeft;App.renderView()">${App.ui.showLeft?'隐藏':'显示'}已离职（历史记录）</button>
      <button class="btn" onclick="App.exportRoster()">⤓ 导出 CSV</button>
      <button class="btn sm" onclick="App.exportImage('排班表_${r.ref.slice(0,7)}')" title="导出当前视图为 PNG 图片">📷 导出图片</button>
      <button class="btn primary" onclick="App.regenSchedule()">⚡ 一键智能排班（当${r.mode==='week'?'周':'月'}）</button>
    </div>
    <div class="roster-wrap">
      <table class="roster">
        <thead><tr><th class="name-col">成员 \\ 日期</th>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <div class="legend">
      ${shiftTypes.map(t => `<span><i style="background:${t.bg};border:1px solid ${t.color}"></i>${t.label}${t.start ? ` ${t.start}-${t.end}` : ''}</span>`).join('')}
      <span><i class="lg-leave"></i>休假</span><span>· 休息</span>
      <span><i class="lg-match"></i>比赛日（需 4 人）</span><span><i class="lg-rest"></i>休赛日（需 2 人）</span>
      ${App.can('manage')?'<span class="hint">｜管理员可点击单元格循环调整班次</span>':''}
    </div>
  </div>`;
}

function roleCN(role){
  return { admin:'管理员', employee:'员工', intern:'实习生' }[role] || role;
}

/* 保存 .roster-wrap 滚动位置 → renderView → 恢复滚动位置 */
App._rosterScrollKeep = function(fn){
  const wrap = document.querySelector('.roster-wrap');
  const sl = wrap ? wrap.scrollLeft : 0;
  const st = wrap ? wrap.scrollTop  : 0;
  fn();
  const nw = document.querySelector('.roster-wrap');
  if(nw){ nw.scrollLeft = sl; nw.scrollTop = st; }
};

/* 手动调整：循环 休 → type[0] → type[1] → ... → 休 */
App.cycleShift = function(date, staffId){
  const st = App.state;
  if(!App.can('manage')) return;
  const types = App.getShiftTypes();
  App.pushHistory('roster');
  st.shifts[date] = st.shifts[date] || {};
  const cur = st.shifts[date][staffId];
  let next;
  if(!cur){
    next = types.length ? types[0].key : 'early';
  } else {
    const idx = types.findIndex(t => t.key === cur);
    if(idx >= 0 && idx < types.length - 1) next = types[idx + 1].key;
    else next = undefined;  // 回到休息
  }
  if(next) st.shifts[date][staffId] = next;
  else delete st.shifts[date][staffId];
  App.save();
  App._rosterScrollKeep(() => App.renderView());
};

App.regenSchedule = function(){
  const r = App.ui.roster;
  if(!confirm('一键智能排班将重新生成该时段全部班表（手动调整会被覆盖，已批准休假者自动排除）。确定继续？')) return;
  App.pushHistory('roster');
  if(r.mode === 'week'){
    // 周视图：对其所在月执行智能排班（覆盖该周），保证算法连贯
    const mon = D.addDays(r.ref, -((D.parse(r.ref).getDay() + 6) % 7));
    const { y, m } = D.ym(mon);
    App.autoSchedule(y, m);
  } else {
    const { y, m } = D.ym(r.ref);
    App.autoSchedule(y, m);
  }
  const shiftTypes = App.getShiftTypes();
  App.toast(`智能排班已生成：比赛日 4 人 / 休赛日 2 人，休假者已排除，${shiftTypes.map(t=>t.label).join('/')}均衡轮转`, 'ok', 5000);
  App._rosterScrollKeep(() => App.renderView());
};

App.undoRoster = function(){
  if(App.undoSection('roster')){
    App.toast('已撤销', 'info', 1500);
    App._rosterScrollKeep(() => App.renderView());
  }
};
App.redoRoster = function(){
  if(App.redoSection('roster')){
    App.toast('已重做', 'info', 1500);
    App._rosterScrollKeep(() => App.renderView());
  }
};
App.resetRoster = function(){
  if(!confirm('确定重置到进入排班页面时的状态？当前所有未同步的排班修改将被撤销。')) return;
  if(App.resetSection('roster')){
    App.toast('已重置到初始状态', 'ok', 2000);
    App._rosterScrollKeep(() => App.renderView());
  }
};

App.clearRoster = function(){
  const r = App.ui.roster;
  let days, label;
  if(r.mode === 'week'){
    const mon = D.addDays(r.ref, -((D.parse(r.ref).getDay() + 6) % 7));
    days = []; for(let i=0;i<7;i++) days.push(D.addDays(mon, i));
    label = '本周';
  } else {
    const { y, m } = D.ym(r.ref);
    days = D.monthDays(y, m);
    label = y + '年' + m + '月';
  }
  const hasShifts = days.some(ds => App.state.shifts[ds] && Object.keys(App.state.shifts[ds]).length);
  if(!hasShifts){ App.toast('当前' + label + '没有排班数据', 'info'); return; }
  if(!confirm('确定清空' + label + '全部排班数据？此操作可通过撤销恢复。')) return;
  App.pushHistory('roster');
  days.forEach(ds => { delete App.state.shifts[ds]; });
  App.save();
  App.toast(label + '排班已清空', 'ok');
  App._rosterScrollKeep(() => App.renderView());
};

App.exportRoster = function(){
  const st = App.state;
  const r = App.ui.roster;
  let days, name;
  if(r.mode === 'week'){
    const mon = D.addDays(r.ref, -((D.parse(r.ref).getDay() + 6) % 7));
    days = []; for(let i=0;i<7;i++) days.push(D.addDays(mon, i));
    name = '排班表_' + mon;
  } else {
    const { y, m } = D.ym(r.ref);
    days = D.monthDays(y, m);
    name = '排班表_' + y + '-' + String(m).padStart(2,'0');
  }
  const staff = st.staff.filter(s => s.status === 'active' || App.ui.showLeft);
  const rows = [['日期','星期','日类型'].concat(staff.map(s => s.name + '(' + roleCN(s.role) + ')'))];
  days.forEach(ds => {
    rows.push([ds, '周' + D.weekdayCN(ds), App.dayType(ds) === 'match' ? '比赛日' : '休赛日'].concat(
      staff.map(s => {
        if(App.onApprovedLeave(s.id, ds)) return '休假';
        const sh = (st.shifts[ds] || {})[s.id];
        return sh ? App.getShiftType(sh).label : '休息';
      })));
  });
  App.exportCSV(name + '.csv', rows);
  App.toast('已导出 ' + name + '.csv', 'ok');
};

/* ---------- 班次类型管理 ---------- */
App.shiftTypesOpen = function(){
  if(!App.can('manage')) return;
  if(!App.state.shiftTypes || !App.state.shiftTypes.length){
    App.state.shiftTypes = App.getShiftTypes();
  }
  App._renderShiftTypesModal();
};

App._renderShiftTypesModal = function(){
  const types = App.state.shiftTypes;
  const PRESET_COLORS = ['#4D7FCC','#9B7DE0','#E5AE15','#0D9093','#DC3030','#3CB371','#E85D75','#5B8DEF'];

  const rowsHTML = types.map((t, i) => `
    <div class="tpl-row" data-idx="${i}">
      <input type="text" value="${t.label}" class="st-label" placeholder="如：中班" style="width:80px">
      <input type="text" value="${t.short}" class="st-short" placeholder="如：中" style="width:40px;text-align:center">
      <input type="time" value="${t.start}" class="st-start" style="width:80px">
      <span style="color:var(--dim)">~</span>
      <input type="time" value="${t.end}" class="st-end" style="width:80px">
      <input type="color" value="${t.color}" class="st-color" style="width:36px;height:32px;padding:2px;border-radius:6px">
      <button class="btn sm danger" onclick="App.shiftTypeDelRow(${i})" title="删除此班次">✕</button>
    </div>`).join('');

  App.modal('班次类型设置', `
    <div class="hint" style="margin-bottom:12px;line-height:1.7">
      定义排班系统中使用的班次类型。管理员可按赛事时区灵活添加中班等自定义班次。<br>
      点击单元格时会按顺序循环：休息 → ${types.map(t=>t.label).join(' → ')} → 休息。<br>
      <b style="color:var(--warn)">注意</b>：删除已有排班数据正在使用的班次类型，那些排班会显示为未知。
    </div>
    <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--sub)">班次列表</div>
    <div style="display:flex;gap:6px;font-size:11px;color:var(--dim);margin-bottom:4px;padding-left:2px">
      <span style="width:80px">名称</span><span style="width:40px">简称</span><span style="width:80px">开始</span><span style="width:20px"></span><span style="width:80px">结束</span><span style="width:36px">颜色</span>
    </div>
    <div id="st-rows">${rowsHTML}</div>
    <button class="btn sm" onclick="App.shiftTypeAddRow()" style="margin-top:4px">+ 添加班次</button>
  `, `
    <button class="btn" onclick="App.closeModal()">取消</button>
    <button class="btn primary" onclick="App.shiftTypeSave()">💾 保存</button>
  `);
};

App._shiftTypeReadFromDOM = function(){
  const rows = document.querySelectorAll('#st-rows .tpl-row');
  const types = [];
  rows.forEach(r => {
    const label = r.querySelector('.st-label').value.trim();
    if(!label) return;
    const short = r.querySelector('.st-short').value.trim() || label.charAt(0);
    const start = r.querySelector('.st-start').value || '';
    const end   = r.querySelector('.st-end').value || '';
    const color = r.querySelector('.st-color').value || '#888';
    const bg    = color + '28';  // hex alpha ~16% 透明度
    const oldKey = App.state.shiftTypes[parseInt(r.dataset.idx)] ?
      App.state.shiftTypes[parseInt(r.dataset.idx)].key : null;
    types.push({ key: oldKey || ('shift_' + Date.now() + '_' + types.length), label, short, start, end, color, bg });
  });
  App.state.shiftTypes = types;
};

App.shiftTypeAddRow = function(){
  App._shiftTypeReadFromDOM();
  App.state.shiftTypes.push({
    key: 'shift_' + Date.now(), label: '新班次', short: '新',
    start: '12:00', end: '20:00', color: '#3CB371', bg: 'rgba(60,179,113,.18)'
  });
  App._renderShiftTypesModal();
};

App.shiftTypeDelRow = function(idx){
  App._shiftTypeReadFromDOM();
  if(App.state.shiftTypes.length <= 1){
    App.toast('至少保留一个班次类型', 'warn');
    return;
  }
  const t = App.state.shiftTypes[idx];
  if(!confirm(`确认删除班次「${t.label}」？`)) return;
  App.state.shiftTypes.splice(idx, 1);
  App._renderShiftTypesModal();
};

App.shiftTypeSave = function(){
  App._shiftTypeReadFromDOM();
  if(!App.state.shiftTypes.length){
    App.toast('至少需要一个班次类型', 'err');
    return;
  }
  if(App.state.shiftTypes.some(t => !t.label)){
    App.toast('存在未填写名称的班次', 'err');
    return;
  }
  App.save();
  App.closeModal();
  App.toast('班次类型已保存，共 ' + App.state.shiftTypes.length + ' 个班次', 'ok');
  App.renderView();
};

/* ---------- 休假审批 ---------- */
function leavePanel(){
  const st = App.state;
  const pending = st.leave.filter(l => l.status === 'pending');
  const history = st.leave.filter(l => l.status !== 'pending')
    .sort((a, b) => (b.decidedAt || b.createdAt) - (a.decidedAt || a.createdAt));
  const row = (l, act) => {
    const s = App.staffById(l.staffId);
    const days = D.parse(l.end).getDate() - D.parse(l.start).getDate() + 1;
    let actionHTML = '';
    if(act){
      actionHTML = `<td>
        <button class="btn sm primary" onclick="App.decideLeave('${l.id}', true)">批准</button>
        <button class="btn sm danger" onclick="App.decideLeave('${l.id}', false)">驳回</button></td>`;
    } else if(l.status === 'approved' && App.can('manage')){
      actionHTML = `<td><button class="btn sm warn" onclick="App.revokeLeave('${l.id}')" title="撤回审批，休假恢复为待审批状态">↶ 撤回</button></td>`;
    } else {
      actionHTML = `<td>—</td>`;
    }
    return `<tr>
      <td>${s ? s.name : '—'}</td>
      <td>${l.start} ~ ${l.end}<span class="hint">（${days} 天）</span></td>
      <td style="white-space:normal;max-width:220px">${l.reason}</td>
      <td>${new Date(l.createdAt).toLocaleString('zh-CN', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'})}</td>
      <td><span class="badge st-${l.status}">${{pending:'待审批',approved:'已批准',rejected:'已驳回'}[l.status]}</span></td>
      ${actionHTML}
    </tr>`;
  };
  return `
  <div class="card">
    <h3><span class="left">待审批 <span class="badge st-pending">${pending.length}</span></span></h3>
    ${pending.length ? `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>申请人</th><th>休假日期</th><th>事由</th><th>提交时间</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>${pending.map(l => row(l, true)).join('')}</tbody></table></div>`
      : '<div class="empty">暂无待审批的休假申请 🎉</div>'}
    <div class="hint" style="margin-top:10px">批准后系统将自动撤销该成员休假期间的全部排班，并通知本人。</div>
  </div>
  <div class="card">
    <h3><span class="left">审批记录</span></h3>
    ${history.length ? `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>申请人</th><th>休假日期</th><th>事由</th><th>提交时间</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>${history.map(l => row(l, false)).join('')}</tbody></table></div>`
      : '<div class="empty">暂无记录</div>'}
  </div>`;
}

App.decideLeave = function(id, ok){
  const st = App.state;
  const l = st.leave.find(x => x.id === id);
  if(!l) return;
  App.pushHistory('roster');
  l.status = ok ? 'approved' : 'rejected';
  l.decidedBy = st.user; l.decidedAt = Date.now();
  if(ok){
    // 撤销休假期间排班
    for(let ds = l.start; ds <= l.end; ds = D.addDays(ds, 1)){
      if(st.shifts[ds] && st.shifts[ds][l.staffId]){
        delete st.shifts[ds][l.staffId];
        if(!Object.keys(st.shifts[ds]).length) delete st.shifts[ds];
      }
    }
    App.notify(l.staffId, `你的休假申请（${l.start} ~ ${l.end}）已批准，休假期间的排班已自动撤销`);
    App.toast('已批准，休假期间排班已自动撤销。可点击「一键智能排班」补足人力', 'ok', 5000);
  } else {
    App.notify(l.staffId, `你的休假申请（${l.start} ~ ${l.end}）未被批准，如有疑问请联系运营主管`);
    App.toast('已驳回并通知本人', 'ok');
  }
  App.save();
  App.renderView();
};

/* 撤回已批准的休假审批 */
App.revokeLeave = function(id){
  const st = App.state;
  const l = st.leave.find(x => x.id === id);
  if(!l || l.status !== 'approved') return;
  const s = App.staffById(l.staffId);
  const name = s ? s.name : '该成员';
  const days = D.parse(l.end).getDate() - D.parse(l.start).getDate() + 1;
  if(!confirm(`确认撤回 ${name} 的休假审批？\n\n` +
    `休假日期：${l.start} ~ ${l.end}（${days} 天）\n` +
    `撤回后该申请将恢复为「待审批」状态，休假期间的排班不会自动恢复，\n` +
    `可点击「一键智能排班」重新生成。`)) return;
  App.pushHistory('roster');
  l.status = 'pending';
  l.decidedBy = null;
  l.decidedAt = null;
  App.notify(l.staffId, `你的休假申请（${l.start} ~ ${l.end}）审批已被撤回，恢复为待审批状态，如有疑问请联系运营主管`);
  App.save();
  App.toast('已撤回审批，休假恢复为待审批状态。排班需手动或智能排班补足', 'ok', 5000);
  App.renderView();
};
function conflictPanel(){
  const r = App.ui.roster || { ref: D.today() };
  const { y, m } = D.ym(r.ref);
  const list = App.ui.conflicts === undefined ? [] : App.ui.conflicts;
  const lvCN = { error:'冲突', warn:'警告', info:'提示' };
  return `
  <div class="card">
    <h3><span class="left">冲突检测 <span class="hint">${y}年${m}月 · 覆盖排班冲突 / 人力不足 / 内容任务异常</span></span>
      <button class="btn primary" onclick="App.runConflicts()">🔍 立即检测</button></h3>
    ${App.ui.conflicts === undefined
      ? '<div class="empty">点击「立即检测」扫描当月排班与内容任务</div>'
      : (list.length === 0
          ? '<div class="empty">未发现冲突，一切正常 ✅</div>'
          : list.map(c => `<div class="conflict-item ${c.level}">
              <span class="badge ${c.level==='error'?'st-rejected':c.level==='warn'?'st-in_progress':'role-admin'}">${lvCN[c.level]}</span>
              <span>${c.text}</span></div>`).join(''))}
    ${list.length ? `<div class="hint">修复建议：假期冲突→调整当日班表；人力不足→一键智能排班；内容异常→前往「责任分配」重新分配。</div>` : ''}
  </div>`;
}

App.runConflicts = function(){
  const r = App.ui.roster || { ref: D.today() };
  const { y, m } = D.ym(r.ref);
  App.ui.conflicts = App.detectConflicts(y, m);
  const errs = App.ui.conflicts.filter(c => c.level === 'error').length;
  App.toast(errs ? `检测到 ${errs} 项冲突、${App.ui.conflicts.length - errs} 项警告` : `检测完成，发现 ${App.ui.conflicts.length} 项警告`, errs ? 'warn' : 'ok');
  App.renderView();
};
