/* =====================================================
 * view-content.js — 内容排期（月视图 / 单日视图）
 * ===================================================== */

const CONTENT_TYPES = ['赛前预热','赛果战报','互动话题','其他'];
const CONTENT_STATUS = { planned:'已排期', in_progress:'制作中', published:'已发布', cancelled:'已取消' };

/* ---------- 主渲染：根据视图模式分发 ---------- */
App.renderContent = function(){
  const mode = App.ui.contentView || 'month';
  if(mode === 'day') return App.renderContentDay();
  return App.renderContentMonth();
};

/* ==================== 月视图 ==================== */
App.renderContentMonth = function(){
  const st = App.state;
  const isAdmin = App.can('manage');
  const monthStr = App.ui.contentMonth || D.today().slice(0, 7);
  const { y, m } = D.ym(monthStr + '-01');
  const fStatus = App.ui.contentFStatus || '';
  const fType = App.ui.contentFType || '';

  // 修复：inRange 作为完整过滤条件使用
  const inRange = c => c.date.slice(0,7) === monthStr
    && (!fStatus || c.status === fStatus) && (!fType || c.type === fType);

  const first = D.parse(monthStr + '-01');
  const lead = (first.getDay() + 6) % 7;
  let cells = '';
  for(let i=0;i<lead;i++) cells += '<div class="cal-cell other"></div>';
  for(const ds of D.monthDays(y, m)){
    const info = st.scheduleDays[ds];
    const type = info ? info.type : 'rest';
    // 修复：先 inRange 再按日期过滤
    const items = st.content.filter(c => inRange(c) && c.date === ds).sort((a,b) => a.time.localeCompare(b.time));
    const chips = items.map(c => {
      const a = c.assigneeId ? App.staffById(c.assigneeId) : null;
      const title = `${c.time} ${c.title}｜${c.type}｜${CONTENT_STATUS[c.status]}${a ? '｜负责：' + a.name : '｜未分配'}${c.note ? '｜备注：' + c.note : ''}`;
      return `<span class="chip t-${c.type} s-${c.status}" title="${title}"
        ${isAdmin ? `onclick="event.stopPropagation();App.contentFormOpen('${c.id}')"` : ''}>${c.time} ${c.title}${a ? ' · ' + a.name : ' · 未分配'}</span>`;
    }).join('');
    // 点击日期数字进入单日视图
    cells += `<div class="cal-cell ${isAdmin ? 'clickable' : ''} ${ds===D.today()?'today':''}" ${isAdmin ? `onclick="App.contentFormOpen(null,'${ds}')"` : ''}>
      <div class="dline"><span class="dnum" style="cursor:pointer" onclick="event.stopPropagation();App.ui.contentView='day';App.ui.contentDay='${ds}';App.renderView()">${D.parse(ds).getDate()}</span>
      <span class="badge ${type}">${type === 'match' ? '赛' : '休'}${info && info.manual ? '·手' : ''}</span></div>
      ${chips}
      ${isAdmin ? '<div class="hint" style="margin-top:2px;opacity:.7">+ 添加</div>' : ''}
    </div>`;
  }

  return `
  <div class="tabs">
    <div class="tab active">月视图</div>
    <div class="tab" onclick="App.ui.contentView='day';App.ui.contentDay=App.ui.contentDay||D.today();App.renderView()">单日视图</div>
  </div>
  <div class="card">
    <div class="toolbar">
      <input type="month" value="${monthStr}" style="width:150px" onchange="App.ui.contentMonth=this.value;App.renderView()">
      <select style="width:120px" onchange="App.ui.contentFType=this.value;App.renderView()">
        <option value="">全部类型</option>
        ${CONTENT_TYPES.map(t=>`<option value="${t}" ${fType===t?'selected':''}>${t}</option>`).join('')}
      </select>
      <select style="width:120px" onchange="App.ui.contentFStatus=this.value;App.renderView()">
        <option value="">全部状态</option>
        ${Object.keys(CONTENT_STATUS).map(k=>`<option value="${k}" ${fStatus===k?'selected':''}>${CONTENT_STATUS[k]}</option>`).join('')}
      </select>
      <div class="spacer"></div>
      <span class="hint">本月 ${st.content.filter(c => c.date.slice(0,7) === monthStr).length} 条内容 · ${st.content.filter(c => c.date.slice(0,7) === monthStr && !c.assigneeId && c.status!=='cancelled').length} 条未分配</span>
    </div>
    <div class="cal-head">${['一','二','三','四','五','六','日'].map(w=>`<div>${w}</div>`).join('')}</div>
    <div class="cal">${cells}</div>
    ${isAdmin ? '<div class="hint" style="margin-top:12px">管理员：点击日期格新增内容，点击内容条目编辑；点击日期数字可进入单日视图。负责人的分配与调整在「责任分配」模块完成。</div>' : '<div class="hint" style="margin-top:12px">点击日期数字可进入单日视图查看详情。</div>'}
  </div>`;
};

/* ==================== 单日视图 ==================== */
App.renderContentDay = function(){
  const st = App.state;
  const isAdmin = App.can('manage');
  const ds = App.ui.contentDay || D.today();
  const info = st.scheduleDays[ds];
  const type = info ? info.type : 'rest';
  const isToday = ds === D.today();
  const prev = D.addDays(ds, -1);
  const next = D.addDays(ds, 1);

  // 当日赛程
  let matchHTML = '';
  if(type === 'match' && info && info.matches.length){
    matchHTML = `<div class="cd-match-list">` + info.matches.map(mt => `
      <div class="cd-match-item">
        <span class="cd-mtime">${mt.time}</span>
        <div>
          <div class="cd-mteams">${mt.teams || '待定'}</div>
          <div class="cd-mstage">${mt.stage || ''}</div>
        </div>
        <span class="cd-mbo">${mt.bo || ''}</span>
      </div>`).join('') + `</div>`;
  } else {
    matchHTML = `<div class="cd-match-list"><div class="cd-match-item"><span class="cd-mstage">休赛日 — 无比赛安排</span></div></div>`;
  }

  // 当日内容条目（按时间排序）
  const items = st.content.filter(c => c.date === ds).sort((a,b) => a.time.localeCompare(b.time));
  let listHTML = '';
  if(items.length){
    listHTML = items.map(c => {
      const a = c.assigneeId ? App.staffById(c.assigneeId) : null;
      const shift = a ? (st.shifts[ds]||{})[a.id] : null;
      const shiftTxt = shift === 'early' ? '早班' : shift === 'late' ? '晚班' : '不在班';
      return `<div class="cd-item">
        <div class="cd-time">${c.time}</div>
        <div class="cd-body">
          <div class="cd-title">${c.title}</div>
          <div class="cd-meta">
            <span class="chip t-${c.type} s-${c.status}" style="display:inline-block;margin:0;pointer-events:none">${c.type}</span>
            <span class="badge st-${c.status}" style="pointer-events:none">${CONTENT_STATUS[c.status]}</span>
            <span class="cd-assignee">负责人：${a ? '<b>' + a.name + '</b>（' + roleCN(a.role) + '·' + shiftTxt + '）' : '<b style="color:var(--warn)">未分配</b>'}</span>
          </div>
          ${c.note ? `<div class="cd-note">备注：${c.note}</div>` : ''}
        </div>
        ${isAdmin ? `<div class="cd-actions"><button class="btn sm" onclick="App.contentFormOpen('${c.id}')">编辑</button></div>` : ''}
      </div>`;
    }).join('');
  } else {
    listHTML = `<div class="cd-item cd-empty">当日暂无排期内容${isAdmin ? '，点击下方按钮添加' : ''}</div>`;
  }

  return `
  <div class="tabs">
    <div class="tab" onclick="App.ui.contentView='month';App.renderView()">月视图</div>
    <div class="tab active">单日视图</div>
  </div>
  <div class="card">
    <div class="cd-nav">
      <button class="btn sm" onclick="App.ui.contentDay='${prev}';App.renderView()">‹ 前一天</button>
      <span class="cd-date">${D.dateCN(ds)}</span>
      <span class="cd-wd">周${D.weekdayCN(ds)}${isToday ? '（今天）' : ''}</span>
      <button class="btn sm" onclick="App.ui.contentDay='${next}';App.renderView()">后一天 ›</button>
      <button class="btn sm" onclick="App.ui.contentDay=D.today();App.renderView()">今天</button>
      <input type="date" value="${ds}" style="width:150px" onchange="App.ui.contentDay=this.value;App.renderView()">
      <div class="spacer"></div>
      <span class="badge ${type}" style="pointer-events:none">${type === 'match' ? '比赛日' : '休赛日'}${info && info.manual ? '·手' : ''}</span>
      <span class="hint">${items.length} 条内容 · ${items.filter(c=>!c.assigneeId&&c.status!=='cancelled').length} 条未分配</span>
    </div>
    ${matchHTML}
    <h3 style="margin:18px 0 10px">内容排期</h3>
    <div class="cd-list">${listHTML}</div>
    ${isAdmin ? `<div style="margin-top:14px"><button class="btn primary" onclick="App.contentFormOpen(null,'${ds}')">+ 添加内容</button></div>` : ''}
  </div>`;
};

/* ---------- 内容新增 / 编辑弹窗 ---------- */
App.contentFormOpen = function(id, presetDate){
  if(!App.can('manage')) return;
  const st = App.state;
  const c = id ? st.content.find(x => x.id === id) : null;
  const date = c ? c.date : (presetDate || D.today());
  const a = c && c.assigneeId ? App.staffById(c.assigneeId) : null;
  App.modal(c ? '编辑内容排期' : '新增内容排期', `
    <div class="form-row">
      <div><label>发布日期 *</label><input type="date" id="cf-date" value="${date}"></div>
      <div><label>发布时间 *</label><input type="time" id="cf-time" value="${c ? c.time : '20:00'}"></div>
    </div>
    <div class="form-row single"><label>标题 *</label><input id="cf-title" value="${c ? c.title : ''}" placeholder="如：赛前预热：今日对阵前瞻"></div>
    <div class="form-row">
      <div><label>内容类型</label>
        <select id="cf-type">${CONTENT_TYPES.map(t=>`<option value="${t}" ${c && c.type===t?'selected':''}>${t}</option>`).join('')}</select>
      </div>
      <div><label>状态</label>
        <select id="cf-status">${Object.keys(CONTENT_STATUS).map(k=>`<option value="${k}" ${c && c.status===k?'selected':''}>${CONTENT_STATUS[k]}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-row single"><label>备注</label><input id="cf-note" value="${c ? c.note : ''}" placeholder="素材链接、注意事项等"></div>
    ${c ? `<div class="hint">当前负责人：${a ? a.name + '（' + roleCN(a.role) + '）' : '未分配'} · 当天班次：${a && (st.shifts[c.date]||{})[a.id] === 'early' ? '早班' : a && (st.shifts[c.date]||{})[a.id] === 'late' ? '晚班' : '不在班/未分配'}</div>` : ''}
  `, `
    ${c ? `<button class="btn danger" onclick="App.contentDelete('${c.id}')">删除</button>` : ''}
    <button class="btn" onclick="App.closeModal()">取消</button>
    <button class="btn primary" onclick="App.contentSave('${id || ''}')">保存</button>
  `);
};

App.contentSave = function(id){
  const title = document.getElementById('cf-title').value.trim();
  const date = document.getElementById('cf-date').value;
  if(!title){ App.toast('请填写标题', 'err'); return; }
  if(!date){ App.toast('请选择日期', 'err'); return; }
  const data = {
    title,
    date,
    time: document.getElementById('cf-time').value || '20:00',
    type: document.getElementById('cf-type').value,
    status: document.getElementById('cf-status').value,
    note: document.getElementById('cf-note').value.trim()
  };
  if(id){
    const c = App.state.content.find(x => x.id === id);
    Object.assign(c, data);
    if(c.assigneeId && !(App.state.shifts[c.date] || {})[c.assigneeId]){
      App.toast('注意：发布日期变更后，原负责人当天不在班，建议前往「责任分配」调整', 'warn', 6000);
    }
    App.toast('内容排期已更新', 'ok');
  } else {
    App.state.content.push({ id: App.uid('C'), assigneeId: null, ...data });
    App.toast('内容已排期，可在「责任分配」中指派负责人', 'ok');
  }
  App.save();
  App.closeModal();
  App.renderView();
};

App.contentDelete = function(id){
  App.state.content = App.state.content.filter(c => c.id !== id);
  App.save();
  App.closeModal();
  App.toast('内容已删除', 'ok');
  App.renderView();
};
