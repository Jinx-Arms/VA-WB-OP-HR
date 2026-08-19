/* =====================================================
 * view-mine.js — 我的面板（普通员工 / 实习生）
 * 个人排班 / 休假申请 / 我负责的内容任务
 * ===================================================== */

App.renderMine = function(){
  const me = App.me();
  if(!me) return '';
  return `
  <div style="margin-bottom:18px">
    <h2 style="font-size:20px">你好，${me.name} 👋</h2>
    <div class="muted" style="font-size:13px">${me.position} · ${roleCN(me.role)}${me.role === 'intern' ? '（实习生不承担内容发布任务，但需按排班到岗）' : ''}</div>
  </div>
  <div class="mine-grid">
    ${mineScheduleCard(me)}
    ${mineLeaveCard(me)}
  </div>
  <div style="margin-top:18px">${mineTaskCard(me)}</div>`;
};

/* ---------- 我的排班 ---------- */
function mineScheduleCard(me){
  const st = App.state;
  let early = 0, late = 0, off = 0, leaveDays = 0;
  const lines = [];
  for(let i=0;i<14;i++){
    const ds = D.addDays(D.today(), i);
    const lv = App.onApprovedLeave(me.id, ds);
    const sh = (st.shifts[ds] || {})[me.id];
    const type = App.dayType(ds) === 'match' ? '<span class="badge match">赛</span>' : '<span class="badge rest">休赛</span>';
    let tag;
    if(lv){ tag = '<span class="shift-tag leave">休假中</span>'; leaveDays++; }
    else if(sh === 'early'){ tag = '<span class="shift-tag early">早班</span>'; early++; }
    else if(sh === 'late'){ tag = '<span class="shift-tag late">晚班</span>'; late++; }
    else { tag = '<span class="shift-tag off">休息</span>'; off++; }
    lines.push(`<div class="day-line"><span class="dt">${ds} 周${D.weekdayCN(ds)}</span>${type}<span style="margin-left:auto">${tag}</span></div>`);
  }
  return `
  <div class="card">
    <h3><span class="left">我的排班 · 未来 14 天</span>
      <span class="hint">早班 ${early} · 晚班 ${late} · 休息 ${off} · 休假 ${leaveDays}</span></h3>
    <div style="max-height:420px;overflow:auto">${lines.join('')}</div>
    <div class="hint" style="margin-top:8px">班表由主管统一安排，如有问题请在休假申请中说明或联系主管。</div>
  </div>`;
}

/* ---------- 休假申请 ---------- */
function mineLeaveCard(me){
  const st = App.state;
  const mine = st.leave.filter(l => l.staffId === me.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  const rows = mine.map(l => `<tr>
    <td>${l.start} ~ ${l.end}</td>
    <td style="white-space:normal;max-width:160px">${l.reason}</td>
    <td><span class="badge st-${l.status}">${{pending:'待审批',approved:'已批准',rejected:'已驳回'}[l.status]}</span></td>
    <td>${l.comment || '—'}</td>
  </tr>`).join('');
  return `
  <div class="card">
    <h3><span class="left">休假申请</span></h3>
    <div class="form-row">
      <div><label>开始日期</label><input type="date" id="lv-start" value="${D.today()}"></div>
      <div><label>结束日期</label><input type="date" id="lv-end" value="${D.today()}"></div>
    </div>
    <div class="form-row single"><label>事由</label><input id="lv-reason" placeholder="请简要说明休假事由"></div>
    <button class="btn primary" onclick="App.submitLeave()">提交申请</button>
    ${mine.length ? `<div class="tbl-wrap" style="margin-top:14px"><table class="tbl" style="min-width:0">
      <thead><tr><th>日期</th><th>事由</th><th>状态</th><th>审批备注</th></tr></thead>
      <tbody>${rows}</tbody></table></div>` : '<div class="empty">暂无申请记录</div>'}
  </div>`;
}

App.submitLeave = function(){
  const start = document.getElementById('lv-start').value;
  const end = document.getElementById('lv-end').value;
  const reason = document.getElementById('lv-reason').value.trim();
  if(!start || !end){ App.toast('请选择休假日期', 'err'); return; }
  if(end < start){ App.toast('结束日期不能早于开始日期', 'err'); return; }
  if(start < D.today()){ App.toast('开始日期不能早于今天', 'err'); return; }
  if(!reason){ App.toast('请填写休假事由', 'err'); return; }
  const me = App.me();
  App.state.leave.push({
    id: App.uid('L'), staffId: me.id, start, end, reason,
    status: 'pending', createdAt: Date.now(), decidedBy: null, decidedAt: null, comment: ''
  });
  // 通知所有管理员
  App.state.staff.filter(s => s.status === 'active' && s.role === 'admin')
    .forEach(a => App.notify(a.id, `${me.name} 提交了休假申请（${start} ~ ${end}），请前往「排班管理 → 休假审批」处理`));
  App.save();
  App.toast('申请已提交，等待主管审批', 'ok');
  App.renderView();
};

/* ---------- 我的内容任务 ---------- */
function mineTaskCard(me){
  const st = App.state;
  const mine = st.content
    .filter(c => c.assigneeId === me.id && c.status !== 'cancelled')
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const canPublish = me.role !== 'intern';
  const rows = mine.map(c => `<tr>
    <td>${c.date} <span class="hint">周${D.weekdayCN(c.date)}</span></td>
    <td>${c.time}</td>
    <td style="white-space:normal;max-width:280px">${c.title}<div class="hint">${c.note || ''}</div></td>
    <td><span class="badge">${c.type}</span></td>
    <td>
      ${canPublish ? `<select style="width:104px" onchange="App.myTaskStatus('${c.id}', this.value)">
        ${Object.keys(CONTENT_STATUS).filter(k => k !== 'cancelled').map(k =>
          `<option value="${k}" ${c.status === k ? 'selected' : ''}>${CONTENT_STATUS[k]}</option>`).join('')}
      </select>` : `<span class="badge st-${c.status}">${CONTENT_STATUS[c.status]}</span>`}
    </td>
  </tr>`).join('');
  const upcoming = mine.filter(c => c.date >= D.today()).length;
  return `
  <div class="card">
    <h3><span class="left">我负责的内容任务 <span class="hint">待完成 ${upcoming} 条</span></span></h3>
    ${mine.length ? `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>日期</th><th>时间</th><th>任务</th><th>类型</th><th>状态</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`
      : `<div class="empty">${me.role === 'intern'
          ? '暂无任务 —— 实习生不承担内容发布任务，请按排班到岗协助即可'
          : '暂无分配给你的内容任务'}</div>`}
    ${canPublish ? '<div class="hint" style="margin-top:8px">发布完成后请及时更新状态，主管会在内容排期中同步看到。</div>' : ''}
  </div>`;
}

App.myTaskStatus = function(contentId, status){
  const c = App.state.content.find(x => x.id === contentId);
  if(!c) return;
  c.status = status;
  const me = App.me();
  App.state.staff.filter(s => s.status === 'active' && s.role === 'admin' && s.id !== me.id)
    .forEach(a => App.notify(a.id, `${me.name} 将 ${D.dateCN(c.date)}《${c.title}》状态更新为「${CONTENT_STATUS[status]}」`));
  App.save();
  App.toast('任务状态已更新', 'ok');
  App.renderView();
};
