/* =====================================================
 * view-staff.js — 人员管理（入职登记 / 离职办理 / 信息维护）
 * 已离职成员保留历史排班记录，便于交接
 * ===================================================== */

App.renderStaff = function(){
  const st = App.state;
  const showLeft = !!App.ui.showLeftStaff;
  const list = st.staff.filter(s => showLeft || s.status === 'active');
  const rows = list.map(s => `
    <tr class="${s.status==='left'?'left':''}">
      <td><b>${s.name}</b></td>
      <td><span class="badge role-${s.role}">${roleCN(s.role)}</span></td>
      <td>${s.position}</td>
      <td>${s.phone}</td>
      <td><code class="uname">${s.username || s.id.toLowerCase()}</code></td>
      <td>${s.joinDate}</td>
      <td>${s.status === 'active'
        ? '<span class="badge st-approved">在职</span>'
        : `<span class="badge st-cancelled">已离职（${s.leaveDate}）</span>`}</td>
      <td>${s.status === 'active' ? `
        <button class="btn sm" onclick="App.staffFormOpen('${s.id}')">编辑</button>
        <button class="btn sm" onclick="App.resetPasswordOpen('${s.id}')" title="重置密码">🔑</button>
        <button class="btn sm danger" onclick="App.staffLeaveOpen('${s.id}')">离职办理</button>` : '<span class="hint">已归档</span>'}
      </td>
    </tr>`).join('');

  return `
  <div class="card">
    <h3><span class="left">团队成员 <span class="hint">在职 ${st.staff.filter(s=>s.status==='active').length} 人 · 已离职 ${st.staff.filter(s=>s.status==='left').length} 人</span></span>
      <div style="display:flex;gap:10px">
        <button class="btn" onclick="App.ui.showLeftStaff=!App.ui.showLeftStaff;App.renderView()">${showLeft?'只看在职':'显示已离职'}</button>
        <button class="btn primary" onclick="App.staffFormOpen()">+ 入职登记</button>
      </div>
    </h3>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>姓名</th><th>角色</th><th>职位</th><th>联系电话</th><th>用户名</th><th>入职日期</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="8"><div class="empty">暂无成员</div></td></tr>'}</tbody>
    </table></div>
    <div class="hint" style="margin-top:10px">离职办理后：账号立即停用、未来排班自动移除；历史排班与任务记录全部保留，可在排班总览勾选「显示已离职」查看，便于交接。</div>
  </div>`;
};

/* ---------- 入职 / 编辑表单 ---------- */
App.staffFormOpen = function(id){
  const s = id ? App.staffById(id) : null;
  App.modal(s ? '编辑成员信息' : '入职登记', `
    <div class="form-row">
      <div><label>姓名 *</label><input id="sf-name" value="${s ? s.name : ''}" placeholder="请输入姓名"></div>
      <div><label>角色权限 *</label>
        <select id="sf-role">
          <option value="employee" ${s && s.role==='employee'?'selected':''}>普通员工（排班 / 休假 / 任务）</option>
          <option value="admin" ${s && s.role==='admin'?'selected':''}>管理员（排班 / 审批 / 人员管理）</option>
          <option value="intern" ${s && s.role==='intern'?'selected':''}>实习生（排班 / 休假，不承担内容发布）</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div><label>职位</label><input id="sf-pos" value="${s ? s.position : ''}" placeholder="如：内容运营"></div>
      <div><label>联系电话</label><input id="sf-phone" value="${s ? s.phone : ''}" placeholder="手机号"></div>
    </div>
    <div class="form-row">
      <div><label>用户名 ${s ? '' : '（留空自动生成）'}</label><input id="sf-username" value="${s ? (s.username || '') : ''}" placeholder="登录用户名"></div>
      <div><label>入职日期 *</label><input type="date" id="sf-join" value="${s ? s.joinDate : D.today()}"></div>
    </div>
    ${s ? '<div class="hint">如需修改密码，请使用 🔑 按钮重置。</div>' : '<div class="hint">新成员初始密码为 vct2026，首次登录后请提醒修改。</div>'}
  `, `
    <button class="btn" onclick="App.closeModal()">取消</button>
    <button class="btn primary" onclick="App.staffSave('${id || ''}')">${s ? '保存修改' : '确认入职'}</button>
  `);
};

App.staffSave = function(id){
  const name = document.getElementById('sf-name').value.trim();
  if(!name){ App.toast('请填写姓名', 'err'); return; }
  const username = document.getElementById('sf-username').value.trim().toLowerCase();
  const data = {
    name,
    role: document.getElementById('sf-role').value,
    position: document.getElementById('sf-pos').value.trim() || '待定',
    phone: document.getElementById('sf-phone').value.trim(),
    joinDate: document.getElementById('sf-join').value
  };
  if(id){
    // 编辑：检查用户名唯一性
    if(username){
      const dup = App.state.staff.find(s => s.id !== id && s.username === username);
      if(dup){ App.toast('用户名已被占用：' + dup.name, 'err'); return; }
    }
    Object.assign(App.staffById(id), data);
    if(username) App.staffById(id).username = username;
    App.toast('成员信息已更新', 'ok');
  } else {
    // 新入职
    const newId = App.uid('S');
    const finalUsername = username || newId.toLowerCase();
    // 检查用户名唯一性
    const dup = App.state.staff.find(s => s.username === finalUsername);
    if(dup){ App.toast('用户名已被占用：' + dup.name, 'err'); return; }
    App.state.staff.push({
      id: newId, status:'active', leaveDate:null,
      username: finalUsername, passwordHash: DEFAULT_PWD_HASH,
      ...data
    });
    App.toast(`${name} 已入职（用户名：${finalUsername}，初始密码：vct2026）`, 'ok', 5000);
  }
  App.save();
  App.closeModal();
  App.renderView();
};

/* ---------- 管理员重置密码 ---------- */
App.resetPasswordOpen = function(id){
  const s = App.staffById(id);
  App.modal(`重置密码 · ${s.name}`, `
    <div class="form-row single"><label>新密码</label><input type="password" id="rp-pwd" placeholder="至少 6 位" autocomplete="new-password"></div>
    <div class="form-row single"><label>确认新密码</label><input type="password" id="rp-confirm" placeholder="再次输入新密码" autocomplete="new-password"></div>
    <div class="hint">重置后请将新密码告知 ${s.name}，建议登录后自行修改。</div>
  `, `
    <button class="btn" onclick="App.closeModal()">取消</button>
    <button class="btn primary" onclick="App.resetPasswordConfirm('${id}')">确认重置</button>
  `);
  setTimeout(() => { const el = document.getElementById('rp-pwd'); if(el) el.focus(); }, 100);
};

App.resetPasswordConfirm = async function(id){
  const newPwd = document.getElementById('rp-pwd').value;
  const confirmPwd = document.getElementById('rp-confirm').value;
  if(!newPwd){ App.toast('请输入新密码', 'err'); return; }
  if(newPwd.length < 6){ App.toast('密码至少 6 位', 'err'); return; }
  if(newPwd !== confirmPwd){ App.toast('两次输入不一致', 'err'); return; }

  const s = App.staffById(id);
  s.passwordHash = await sha256(newPwd);
  App.save();
  App.closeModal();
  App.toast(`${s.name} 的密码已重置`, 'ok');
};

/* ---------- 离职办理 ---------- */
App.staffLeaveOpen = function(id){
  const s = App.staffById(id);
  const st = App.state;
  const today = D.today();
  let futureDays = 0;
  Object.keys(st.shifts).forEach(ds => { if(ds >= today && st.shifts[ds][id]) futureDays++; });
  const futureTasks = st.content.filter(c => c.assigneeId === id && c.date >= today && c.status !== 'cancelled').length;
  App.modal(`离职办理 · ${s.name}`, `
    <div class="conflict-item warn">⚠️ 离职后该成员将无法登录，未来 ${futureDays} 天排班自动移除${futureTasks ? `，${futureTasks} 条待发布内容需重新分配负责人` : ''}。历史记录将完整保留。</div>
    <div class="form-row single" style="margin-top:14px"><label>离职日期</label><input type="date" id="sf-leave" value="${today}"></div>
    <div class="hint">离职交接提示：导出其历史排班（排班管理 → 显示已离职 → 导出 CSV）交由接手人。</div>
  `, `
    <button class="btn" onclick="App.closeModal()">取消</button>
    <button class="btn danger" onclick="App.staffLeaveConfirm('${id}')">确认离职</button>
  `);
};

App.staffLeaveConfirm = function(id){
  const st = App.state;
  const s = App.staffById(id);
  const leaveDate = document.getElementById('sf-leave').value || D.today();
  s.status = 'left';
  s.leaveDate = leaveDate;
  // 移除离职日起的全部排班
  Object.keys(st.shifts).forEach(ds => {
    if(ds >= leaveDate && st.shifts[ds][id]){
      delete st.shifts[ds][id];
      if(!Object.keys(st.shifts[ds]).length) delete st.shifts[ds];
    }
  });
  // 待发布任务清空负责人（保留任务，等待重新分配）
  st.content.forEach(c => {
    if(c.assigneeId === id && c.date >= leaveDate && c.status !== 'cancelled') c.assigneeId = null;
  });
  App.save();
  App.closeModal();
  App.toast(`${s.name} 离职办理完成：未来排班已移除，待发布任务已释放，历史记录已保留`, 'ok', 6000);
  if(st.user === id) App.logout();   // 若离职的是当前登录者
  App.renderView();
};
