/* =====================================================
 * view-handover.js — 工作交接（值班人 ↔ 休假人 待办交付）
 * 双向：pre-leave（休假前交代给顶班）/ post-return（返岗认领值班期间新增）
 * 归集范围：content 任务 + story 看点 + 排班值班备注（均有归属人）
 * 战报(report) 为团队自动产物，不挂个人，不纳入交接单。
 * 认领不改原事项归属，仅在交接单 items[].done 标记。
 * ===================================================== */

App.renderHandover = function(){
  const me = App.me();
  if(!me) return '';
  const st = App.state;
  const handovers = st.handovers || [];
  const mine_sent = handovers.filter(h => h.fromId === me.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  const mine_recv = handovers.filter(h => h.toId === me.id)
    .sort((a, b) => b.createdAt - a.createdAt);

  return `
  <div class="card">
    <div class="toolbar">
      <h3 style="margin:0"><span class="left">🔁 工作交接</span></h3>
      <div class="spacer"></div>
      <button class="btn primary" onclick="App.handoverStart()">＋ 发起交接</button>
    </div>
    <div class="hint" style="margin:8px 0 4px">双向交接：休假前把待办交代给顶班（pre-leave），或值班期间新增事项由返岗同事认领（post-return）。交接仅标记完成情况，<b>不改动原任务归属人</b>。</div>
  </div>

  <div class="mine-grid" style="margin-top:16px">
    <div class="card">
      <h3><span class="left">我收到的交接 <span class="hint">${mine_recv.filter(h=>h.status!=='acknowledged').length} 条待确认</span></span></h3>
      ${mine_recv.length ? recvListHTML(mine_recv) : '<div class="empty">暂无同事向你交付交接单</div>'}
    </div>
    <div class="card">
      <h3><span class="left">我发起的交接</span></h3>
      ${mine_sent.length ? sentListHTML(mine_sent) : '<div class="empty">你还没有发起过交接</div>'}
    </div>
  </div>`;
};

function recvListHTML(list){
  return list.map(h => {
    const from = App.staffById(h.fromId);
    const doneCount = h.items.filter(i => i.done).length;
    const ackBtn = h.status !== 'acknowledged'
      ? `<button class="btn sm primary" onclick="App.handoverAck('${h.id}')">✓ 确认交接</button>`
      : `<span class="badge st-published">已确认 ${D.timeCN(h.acknowledgedAt)}</span>`;
    return `
    <div class="ho-card ${h.status==='acknowledged'?'ack':''}">
      <div class="ho-head">
        <b>${from ? from.name : '同事'}</b> · ${App.HANDOVER_TYPE[h.type]}
        <span class="badge st-${h.status==='acknowledged'?'published':'in_progress'}">${App.HANDOVER_STATUS[h.status]}</span>
        <span class="hint" style="margin-left:auto">${doneCount}/${h.items.length} 项完成</span>
      </div>
      <div class="ho-items">
        ${h.items.map((it, idx) => `
          <label class="ho-item ${it.done?'done':''}" onclick="App.handoverToggleItem('${h.id}',${idx});App.renderView()">
            <input type="checkbox" ${it.done?'checked':''} onchange="event.stopPropagation()">
            <span class="ho-pri pri-${it.priority}">${it.priority}</span>
            <span class="ho-title">${it.title}</span>
            ${it.date ? `<span class="hint">${it.date}</span>` : ''}
          </label>`).join('')}
      </div>
      ${h.note ? `<div class="hint" style="margin-top:6px">备注：${h.note}</div>` : ''}
      <div style="margin-top:8px;display:flex;gap:8px;align-items:center">${ackBtn}</div>
    </div>`;
  }).join('');
}

function sentListHTML(list){
  return list.map(h => {
    const to = App.staffById(h.toId);
    const doneCount = h.items.filter(i => i.done).length;
    return `
    <div class="ho-card">
      <div class="ho-head">
        → <b>${to ? to.name : '同事'}</b> · ${App.HANDOVER_TYPE[h.type]}
        <span class="badge st-${h.status==='acknowledged'?'published':'in_progress'}">${App.HANDOVER_STATUS[h.status]}</span>
        <span class="hint" style="margin-left:auto">对方完成 ${doneCount}/${h.items.length}</span>
      </div>
      <div class="ho-items">
        ${h.items.map(it => `
          <div class="ho-item ${it.done?'done':''}">
            <span class="ho-pri pri-${it.priority}">${it.priority}</span>
            <span class="ho-title">${it.title}</span>
            ${it.date ? `<span class="hint">${it.date}</span>` : ''}
          </div>`).join('')}
      </div>
      ${h.status === 'acknowledged' ? `<div class="hint" style="margin-top:6px">✓ 已被确认（${D.ts(h.acknowledgedAt)}）</div>` : '<div class="hint" style="margin-top:6px">等待对方确认…</div>'}
    </div>`;
  }).join('');
}

/* ---------- 发起交接向导 ---------- */
App.handoverStart = function(){
  const me = App.me();
  const st = App.state;
  // 候选接收人：在职、非本人
  const candidates = st.staff.filter(s => s.status === 'active' && s.id !== me.id);
  const opts = candidates.map(s =>
    `<option value="${s.id}">${s.name}（${roleCN(s.role)} · ${s.position}）</option>`).join('');

  // 默认归集我自己的待办
  const myItems = App.collectOwnerItems(me.id, { onlyPending: true });

  App.modal('发起工作交接', `
      <div class="form-row">
        <div><label>交接类型</label>
          <select id="ho-type">
            <option value="pre-leave">休假前交代（pre-leave）</option>
            <option value="post-return">返岗认领（post-return）</option>
          </select>
        </div>
        <div><label>接收人</label><select id="ho-to">${opts}</select></div>
      </div>
      <div class="form-row single"><div><label>备注（选填，如休假起止、重点关注事项）</label>
        <input id="ho-note" placeholder="例如：8/25-8/27 年假，微博话题由你接手"></div></div>
      <div class="hint" style="margin:4px 0 8px">以下为系统按「归属人=你」自动归集的待办（content 任务 / story 看点 / 值班日），可逐项勾选要交付的项：</div>
      <div id="ho-items" class="ho-pick">
        ${myItems.length ? myItems.map((it, idx) => `
          <label class="ho-item">
            <input type="checkbox" data-idx="${idx}" checked>
            <span class="ho-pri pri-${it.priority}">${it.priority}</span>
            <span class="ho-title">[${it.refType}] ${it.title}</span>
            ${it.date ? `<span class="hint">${it.date}</span>` : ''}
          </label>`).join('')
        : '<div class="empty">你当前没有归属中的待办事项 🎉</div>'}
      </div>
  `, `
      <button class="btn" onclick="App.closeModal()">取消</button>
      <button class="btn primary" onclick="App.handoverSubmit()">生成并交付</button>
  `);
  // 把待选项暂存，提交时读取
  App._hoDraft = myItems;
};

App.handoverSubmit = function(){
  const me = App.me();
  const type = document.getElementById('ho-type').value;
  const toId = document.getElementById('ho-to').value;
  const note = document.getElementById('ho-note').value.trim();
  const checked = Array.from(document.querySelectorAll('#ho-items input[type=checkbox]:checked'))
    .map(cb => App._hoDraft[parseInt(cb.dataset.idx)]);
  if(!toId){ App.toast('请选择接收人', 'err'); return; }
  if(!checked.length){ App.toast('请至少勾选一项待办', 'err'); return; }
  const ho = App.createHandover(me.id, toId, type, [D.today(), D.today()], checked, note);
  App.closeModal();
  App.toast(`交接单已交付给 ${App.staffById(toId).name}（${checked.length} 项）`, 'ok', 4000);
  App.nav('handover');
};
