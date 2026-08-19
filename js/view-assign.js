/* =====================================================
 * view-assign.js — 责任分配（内容 × 当班人员自动匹配 / 通知 / 调整）
 * 规则：只分配给当天当班、在职、非实习生的成员
 * ===================================================== */

App.renderAssign = function(){
  const st = App.state;
  const today = D.today();
  const items = st.content
    .filter(c => c.date >= today && c.status !== 'cancelled')
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const unassigned = items.filter(c => !c.assigneeId).length;

  const rows = items.map(c => {
    const duty = Object.keys(st.shifts[c.date] || {});
    const onDutyStaff = duty
      .map(id => App.staffById(id))
      .filter(s => s && s.status === 'active' && s.role !== 'intern');
    const others = st.staff
      .filter(s => s.status === 'active' && s.role !== 'intern' && !onDutyStaff.includes(s));
    const cur = c.assigneeId ? App.staffById(c.assigneeId) : null;
    const curOnDuty = cur && duty.includes(cur.id);
    const sel = `<select style="min-width:130px" onchange="App.assignChange('${c.id}', this.value)">
        <option value="">— 未分配 —</option>
        ${onDutyStaff.length ? `<optgroup label="当天当班">${onDutyStaff.map(s =>
          `<option value="${s.id}" ${c.assigneeId === s.id ? 'selected' : ''}>${s.name}（${roleCN(s.role)}）</option>`).join('')}</optgroup>` : ''}
        ${others.length ? `<optgroup label="其他在职成员（当天不在班）">${others.map(s =>
          `<option value="${s.id}" ${c.assigneeId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</optgroup>` : ''}
      </select>`;
    const statusBadge = !cur ? '<span class="badge st-rejected">未分配</span>'
      : !curOnDuty ? '<span class="badge st-in_progress">负责人不在班</span>'
      : (st.shifts[c.date] || {})[cur.id] === 'early' ? '<span class="badge role-admin">早班当班</span>'
      : '<span class="badge role-employee">晚班当班</span>';
    return `<tr>
      <td>${c.date}<span class="hint"> 周${D.weekdayCN(c.date)}</span></td>
      <td>${c.time}</td>
      <td style="white-space:normal;max-width:240px">${c.title}</td>
      <td><span class="badge">${c.type}</span></td>
      <td>${sel}</td>
      <td>${statusBadge}</td>
      <td><button class="btn sm" onclick="App.assignNotify('${c.id}')">🔔 通知</button></td>
    </tr>`;
  }).join('');

  return `
  <div class="card">
    <h3><span class="left">责任分配 <span class="hint">仅显示今天及以后的内容</span></span>
      <div style="display:flex;gap:10px">
        <button class="btn" onclick="App.autoAssignAll()">🔔 智能分配并通知全部</button>
        <button class="btn primary" onclick="App.autoAssignAll(false)">⚡ 智能分配（暂不通知）</button>
      </div>
    </h3>
    <div class="toolbar">
      <span class="badge st-pending">未分配 ${unassigned} 条</span>
      <span class="badge st-approved">已分配 ${items.length - unassigned} 条</span>
      <span class="hint">｜分配规则：当天当班的在职正式成员（管理员/员工），实习生不参与内容发布任务；按任务量自动均衡。</span>
    </div>
    ${items.length ? `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>日期</th><th>时间</th><th>内容标题</th><th>类型</th><th>负责人</th><th>当班状态</th><th>操作</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`
      : '<div class="empty">暂无待分配内容，可在「内容排期」中新增</div>'}
  </div>`;
};

App.autoAssignAll = function(notify = true){
  const res = App.autoAssign(!notify);   // notify=true → 非 silent → 自动发通知
  App.toast(`智能分配完成：共处理 ${res.total} 条内容，更新 ${res.changed} 条负责人${notify ? '，已通知相关成员' : ''}`, 'ok', 5000);
  App.renderView();
};

App.assignChange = function(contentId, staffId){
  const c = App.state.content.find(x => x.id === contentId);
  if(!c) return;
  c.assigneeId = staffId || null;
  if(staffId){
    const s = App.staffById(staffId);
    if(s.role === 'intern'){ App.toast('实习生不能承担内容发布任务', 'err'); c.assigneeId = null; App.renderView(); return; }
    if(!(App.state.shifts[c.date] || {})[staffId]){
      App.toast(`提醒：${s.name} 在 ${D.dateCN(c.date)} 不当班，建议调整排班或换人`, 'warn', 5000);
    }
    App.notify(staffId, `你被分配负责 ${D.dateCN(c.date)}《${c.title}》（${c.type}），请按时发布`);
  }
  App.save();
  App.renderView();
};

App.assignNotify = function(contentId){
  const c = App.state.content.find(x => x.id === contentId);
  if(!c) return;
  if(!c.assigneeId){ App.toast('该内容尚未分配负责人', 'warn'); return; }
  const s = App.staffById(c.assigneeId);
  App.notify(c.assigneeId, `任务提醒：${D.dateCN(c.date)} ${c.time}《${c.title}》（${c.type}），请按时发布`);
  App.save();
  App.toast(`已通知 ${s.name}`, 'ok');
  App.renderShell();   // 刷新顶部铃铛
};
