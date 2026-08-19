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
      let cls = 'cell', txt = '·';
      if(lv){ cls += ' leave-cell'; txt = '假'; }
      else if(sh === 'early'){ cls += ' early'; txt = '早'; }
      else if(sh === 'late'){ cls += ' late'; txt = '晚'; }
      if(isAdmin && s.status === 'active') cls += ' editable';
      const click = isAdmin && s.status === 'active' ? `onclick="App.cycleShift('${ds}','${s.id}')"` : '';
      const tip = lv ? '休假中（点击可临时加班）' : sh === 'early' ? '早班（点击调整）' : sh === 'late' ? '晚班（点击调整）' : '休息（点击排班）';
      return `<td class="${cls}" title="${s.name} ${D.dateCN(ds)}：${tip}" ${click}>${txt}</td>`;
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
      <button class="btn sm danger" onclick="App.clearRoster()" title="清空当前时段全部排班">🗑 清空</button>` : ''}
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
      <button class="btn primary" onclick="App.regenSchedule()">⚡ 一键智能排班（当${r.mode==='week'?'周':'月'}）</button>
    </div>
    <div class="roster-wrap">
      <table class="roster">
        <thead><tr><th class="name-col">成员 \\ 日期</th>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <div class="legend">
      <span><i class="lg-early"></i>早班</span><span><i class="lg-late"></i>晚班</span>
      <span><i class="lg-leave"></i>休假</span><span>· 休息</span>
      <span><i class="lg-match"></i>比赛日（需 4 人）</span><span><i class="lg-rest"></i>休赛日（需 2 人）</span>
      ${App.can('manage')?'<span class="hint">｜管理员可点击单元格循环调整：休息 → 早班 → 晚班 → 休息</span>':''}
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

/* 手动调整：循环 休 → 早 → 晚 → 休 */
App.cycleShift = function(date, staffId){
  const st = App.state;
  if(!App.can('manage')) return;
  App.pushHistory('roster');
  st.shifts[date] = st.shifts[date] || {};
  const cur = st.shifts[date][staffId];
  const next = cur === 'early' ? 'late' : cur === 'late' ? undefined : 'early';
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
  App.toast('智能排班已生成：比赛日 4 人 / 休赛日 2 人，休假者已排除，早/晚班均衡轮转', 'ok', 5000);
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
        return sh === 'early' ? '早班' : sh === 'late' ? '晚班' : '休息';
      })));
  });
  App.exportCSV(name + '.csv', rows);
  App.toast('已导出 ' + name + '.csv', 'ok');
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
