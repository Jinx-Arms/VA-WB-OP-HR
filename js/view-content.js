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
      ${isAdmin ? `<div class="undo-group">
        <button class="btn sm" onclick="App.undoContent()" ${!App.canUndo('content')?'disabled':''} title="撤销上次操作">↶ 撤销</button>
        <button class="btn sm" onclick="App.redoContent()" ${!App.canRedo('content')?'disabled':''} title="重做">↷ 重做</button>
        <button class="btn sm" onclick="App.resetContent()" ${!App.canReset('content')?'disabled':''} title="重置到进入页面时的状态">↺ 重置</button>
      </div>
      <button class="btn sm danger" onclick="App.clearContent()" title="清空当月全部内容排期">🗑 清空</button>
      <button class="btn sm" onclick="App.contentTemplateOpen()" title="编辑比赛日内容模板并一键部署">📋 模板</button>` : ''}
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
      ${isAdmin ? `<div class="undo-group">
        <button class="btn sm" onclick="App.undoContent()" ${!App.canUndo('content')?'disabled':''} title="撤销上次操作">↶ 撤销</button>
        <button class="btn sm" onclick="App.redoContent()" ${!App.canRedo('content')?'disabled':''} title="重做">↷ 重做</button>
        <button class="btn sm" onclick="App.resetContent()" ${!App.canReset('content')?'disabled':''} title="重置到进入页面时的状态">↺ 重置</button>
      </div>
      <button class="btn sm danger" onclick="App.clearContent()" title="清空当日全部内容排期">🗑 清空</button>` : ''}
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
  App.pushHistory('content');
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
  App.pushHistory('content');
  App.state.content = App.state.content.filter(c => c.id !== id);
  App.save();
  App.closeModal();
  App.toast('内容已删除', 'ok');
  App.renderView();
};

/* ---------- 撤销 / 重做 / 重置 ---------- */
App.undoContent = function(){
  if(App.undoSection('content')){
    App.toast('已撤销', 'info', 1500);
    App.renderView();
  }
};
App.redoContent = function(){
  if(App.redoSection('content')){
    App.toast('已重做', 'info', 1500);
    App.renderView();
  }
};
App.resetContent = function(){
  if(!confirm('确定重置到进入内容排期时的状态？当前所有未同步的内容修改将被撤销。')) return;
  if(App.resetSection('content')){
    App.toast('已重置到初始状态', 'ok', 2000);
    App.renderView();
  }
};

App.clearContent = function(){
  const mode = App.ui.contentView || 'month';
  let items, label, filterFn;
  if(mode === 'day'){
    const ds = App.ui.contentDay || D.today();
    items = App.state.content.filter(c => c.date === ds);
    label = D.dateCN(ds);
    filterFn = c => c.date !== ds;
  } else {
    const monthStr = App.ui.contentMonth || D.today().slice(0, 7);
    items = App.state.content.filter(c => c.date.slice(0,7) === monthStr);
    label = monthStr.replace('-','年') + '月';
    filterFn = c => c.date.slice(0,7) !== monthStr;
  }
  if(!items.length){ App.toast(label + '没有内容排期数据', 'info'); return; }
  if(!confirm('确定清空' + label + '的全部内容排期（共 ' + items.length + ' 条）？此操作可通过撤销恢复。')) return;
  App.pushHistory('content');
  App.state.content = App.state.content.filter(filterFn);
  App.save();
  App.toast(label + '内容排期已清空', 'ok');
  App.renderView();
};

/* ---------- 比赛日内容模板（可编辑 + 一键部署） ---------- */

App.getDefaultContentTemplate = function(){
  return [
    { time: '15:00', title: '赛前预热：今日对阵前瞻', type: '赛前预热', note: '' },
    { time: '23:30', title: '赛果战报：今日比赛速递', type: '赛果战报', note: '' }
  ];
};

/* 扫描全部赛程，按赛事分类 + 阶段前缀分组比赛日
 * 使用 App.state.eventCategories 中的 keywords 做关键词匹配
 * 未匹配的自动归入"其他赛事"
 * 返回: { categoryLabel: { days:[], stages: { stagePrefix: [] } } } */
App._getEventGroups = function(){
  const days = App.state.scheduleDays;
  const cats = App.state.eventCategories || [];
  const map = {};
  for(const ds of Object.keys(days)){
    const info = days[ds];
    if(!info || info.type !== 'match' || !info.matches || !info.matches.length) continue;
    const firstName = info.matches[0].name || '';
    /* 按 eventCategories 顺序匹配，首个命中即归属 */
    let label = '其他赛事';
    for(const cat of cats){
      if(cat.keywords && cat.keywords.some(kw => firstName.includes(kw))){
        label = cat.label;
        break;
      }
    }
    const stage = info.matches[0].stage || '';
    const stagePrefix = stage.split('·')[0] || '未分类';
    if(!map[label]) map[label] = { days: [], stages: {} };
    map[label].days.push(ds);
    if(!map[label].stages[stagePrefix]) map[label].stages[stagePrefix] = [];
    map[label].stages[stagePrefix].push(ds);
  }
  for(const ev of Object.keys(map)){
    map[ev].days.sort();
    for(const sp of Object.keys(map[ev].stages)) map[ev].stages[sp].sort();
  }
  return map;
};

/* 根据下拉选项值获取目标比赛日列表
 * scope 格式: "month" | "event:EventName" | "event:EventName|StagePrefix" */
App._getTargetDays = function(scope){
  if(scope === 'month'){
    const monthStr = App.ui.contentMonth || D.today().slice(0, 7);
    return Object.keys(App.state.scheduleDays)
      .filter(ds => ds.slice(0,7) === monthStr && App.state.scheduleDays[ds].type === 'match')
      .sort();
  }
  if(scope && scope.indexOf('event:') === 0){
    const rest = scope.slice(6);
    const idx = rest.indexOf('|');
    const ev  = idx >= 0 ? rest.slice(0, idx) : rest;
    const sp  = idx >= 0 ? rest.slice(idx + 1) : null;
    const groups = App._getEventGroups();
    if(!groups[ev]) return [];
    if(sp && groups[ev].stages[sp]) return groups[ev].stages[sp];
    return groups[ev].days;
  }
  return [];
};

App.contentTemplateOpen = function(){
  if(!App.can('manage')) return;
  if(!App.state.contentTemplate || !App.state.contentTemplate.length){
    App.state.contentTemplate = App.getDefaultContentTemplate();
  }
  App._renderContentTemplateModal();
};

App._renderContentTemplateModal = function(){
  const tpl = App.state.contentTemplate;
  const monthStr = App.ui.contentMonth || D.today().slice(0, 7);
  const monthMatchDays = Object.keys(App.state.scheduleDays)
    .filter(ds => ds.slice(0,7) === monthStr && App.state.scheduleDays[ds].type === 'match')
    .sort();
  const eventGroups = App._getEventGroups();

  /* 构建部署范围下拉选项 */
  let scopeOpts = `<option value="month">当月比赛日（${monthMatchDays.length} 天）</option>`;
  for(const ev of Object.keys(eventGroups)){
    const g = eventGroups[ev];
    scopeOpts += `<option value="event:${ev}">${ev} — 全部（${g.days.length} 天）</option>`;
    for(const sp of Object.keys(g.stages)){
      scopeOpts += `<option value="event:${ev}|${sp}">　 └ ${sp}（${g.stages[sp].length} 天）</option>`;
    }
  }

  const rowsHTML = tpl.map((item, i) => `
    <div class="tpl-row" data-idx="${i}">
      <input type="time" value="${item.time}" class="tpl-time" style="width:85px">
      <input type="text" value="${item.title}" class="tpl-title" placeholder="如：赛前预热：今日对阵前瞻" style="flex:1;min-width:120px">
      <select class="tpl-type" style="width:110px">
        ${CONTENT_TYPES.map(t=>`<option value="${t}" ${item.type===t?'selected':''}>${t}</option>`).join('')}
      </select>
      <button class="btn sm danger" onclick="App.contentTemplateDelRow(${i})" title="删除此行">✕</button>
    </div>`).join('');

  App.modal('比赛日内容模板', `
    <div class="hint" style="margin-bottom:12px;line-height:1.7">
      定义比赛日的标准内容排期模板。选择部署范围后点击「一键部署」可将模板批量应用到对应比赛日，
      无需逐条手动添加。模板会自动保存到云端，所有管理员共享。
    </div>
    <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--sub)">模板条目（每条 = 每个比赛日发布的一条内容）</div>
    <div id="tpl-rows">${rowsHTML}</div>
    <button class="btn sm" onclick="App.contentTemplateAddRow()" style="margin-top:4px">+ 添加模板项</button>
    <div style="border-top:1px solid var(--line);margin:16px 0;padding-top:14px">
      <div style="font-size:13px;font-weight:600;margin-bottom:10px;color:var(--sub)">部署范围与选项</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <label style="font-size:13px;white-space:nowrap">目标范围</label>
        <select id="tpl-scope" style="flex:1;min-width:200px" onchange="App._updateTplScopeInfo()">
          ${scopeOpts}
        </select>
      </div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
        <input type="checkbox" id="tpl-overwrite" checked style="width:16px;height:16px">
        覆盖已有内容（取消勾选则仅向无内容的空白比赛日部署）
      </label>
      <div class="hint" id="tpl-scope-info" style="margin-top:8px"></div>
    </div>
    <details style="border-top:1px solid var(--line);margin-top:16px;padding-top:14px">
      <summary style="font-size:13px;font-weight:600;color:var(--sub);cursor:pointer;user-select:none">
        赛事分类管理（${(App.state.eventCategories||[]).length} 个分类）— 点击展开
      </summary>
      <div class="hint" style="margin:10px 0;line-height:1.6">
        关键词用于自动识别赛程数据中的赛事名称。系统按分类顺序匹配，首个命中的关键词决定比赛日归属。
        添加新赛事时，填入赛事名称中出现的 distinctive 关键词即可（支持中英文）。
      </div>
      <div id="event-cat-list"></div>
      <div style="display:flex;gap:6px;align-items:flex-end;margin-top:8px;flex-wrap:wrap">
        <div style="display:flex;flex-direction:column;gap:2px">
          <label style="font-size:11px;color:var(--sub)">分类名称</label>
          <input type="text" id="ec-label" placeholder="如：晋升赛" style="width:130px;padding:4px 8px;font-size:13px">
        </div>
        <div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:180px">
          <label style="font-size:11px;color:var(--sub)">关键词（逗号分隔，支持多个）</label>
          <input type="text" id="ec-keywords" placeholder="如：晋升赛, Ascension" style="flex:1;min-width:180px;padding:4px 8px;font-size:13px">
        </div>
        <button class="btn sm" onclick="App.eventCatAdd()">+ 添加</button>
      </div>
      <button class="btn sm" onclick="App.eventCatSave()" style="margin-top:8px">💾 保存分类到云端</button>
    </details>
  `, `
    <button class="btn" onclick="App.closeModal()">取消</button>
    <button class="btn" onclick="App.contentTemplateSave()">💾 保存模板</button>
    <button class="btn primary" onclick="App.contentTemplateDeploy()">⚡ 一键部署</button>
  `);
  /* 初始化范围信息 */
  App._updateTplScopeInfo();
  /* 渲染赛事分类列表 */
  App._renderEventCatList();
};

/* 更新部署范围提示信息 */
App._updateTplScopeInfo = function(){
  const sel = document.getElementById('tpl-scope');
  if(!sel) return;
  const days = App._getTargetDays(sel.value);
  const info = document.getElementById('tpl-scope-info');
  if(info){
    info.innerHTML = days.length
      ? `目标范围共 <b style="color:var(--txt)">${days.length}</b> 个比赛日：` +
        days.slice(0,6).map(d => D.dateCN(d)).join('、') + (days.length > 6 ? ' 等' : '')
      : '所选范围内没有比赛日';
  }
};

/* ---------- 赛事分类管理（CRUD） ---------- */

/* 渲染赛事分类列表（弹窗内） */
App._renderEventCatList = function(){
  const box = document.getElementById('event-cat-list');
  if(!box) return;
  const cats = App.state.eventCategories || [];
  if(!cats.length){
    box.innerHTML = '<div class="hint" style="padding:8px 0">暂无分类，所有比赛日将归入"其他赛事"</div>';
    return;
  }
  box.innerHTML = cats.map((cat, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed var(--line);font-size:13px">
      <span style="font-weight:600;min-width:100px;color:var(--txt)">${cat.label}</span>
      <span style="color:var(--sub);flex:1;font-size:12px">关键词：${(cat.keywords||[]).join('、')}</span>
      <button class="btn sm danger" onclick="App.eventCatDel(${i})" title="删除此分类">✕</button>
    </div>`).join('');
};

/* 添加赛事分类 */
App.eventCatAdd = function(){
  const labelInput = document.getElementById('ec-label');
  const kwInput    = document.getElementById('ec-keywords');
  if(!labelInput || !kwInput) return;
  const label = labelInput.value.trim();
  const keywords = kwInput.value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
  if(!label){ App.toast('请填写分类名称', 'err'); return; }
  if(!keywords.length){ App.toast('请至少填写一个关键词', 'err'); return; }
  if(!App.state.eventCategories) App.state.eventCategories = [];
  /* 检查重名 */
  if(App.state.eventCategories.some(c => c.label === label)){
    App.toast('分类名称已存在', 'err'); return;
  }
  App.state.eventCategories.push({
    id: 'ec-' + Date.now(),
    label: label,
    keywords: keywords
  });
  labelInput.value = '';
  kwInput.value = '';
  App._renderEventCatList();
  /* 更新折叠标题计数 */
  const summary = document.querySelector('.modal-body details summary');
  if(summary) summary.textContent = `赛事分类管理（${App.state.eventCategories.length} 个分类）— 点击展开`;
  App.toast('已添加分类「' + label + '」，记得点击保存', 'ok');
};

/* 删除赛事分类 */
App.eventCatDel = function(idx){
  if(!App.state.eventCategories || !App.state.eventCategories[idx]) return;
  const cat = App.state.eventCategories[idx];
  if(!confirm('确认删除分类「' + cat.label + '」？\n删除后，对应赛事的比赛日将归入"其他赛事"。')) return;
  App.state.eventCategories.splice(idx, 1);
  App._renderEventCatList();
  const summary = document.querySelector('.modal-body details summary');
  if(summary) summary.textContent = `赛事分类管理（${App.state.eventCategories.length} 个分类）— 点击展开`;
  App.toast('已删除分类「' + cat.label + '」，记得点击保存', 'ok');
};

/* 保存赛事分类到云端 */
App.eventCatSave = function(){
  App.save();
  App.toast('赛事分类已保存到云端', 'ok');
  /* 刷新部署范围下拉（新分类可能影响分组） */
  App._renderContentTemplateModal();
};

/* 从弹窗 DOM 读取当前编辑的模板 */
App.contentTemplateReadFromDOM = function(){
  const rows = document.querySelectorAll('.tpl-row');
  const tpl = [];
  rows.forEach(row => {
    tpl.push({
      time: row.querySelector('.tpl-time').value || '20:00',
      title: row.querySelector('.tpl-title').value.trim(),
      type: row.querySelector('.tpl-type').value,
      note: ''
    });
  });
  App.state.contentTemplate = tpl;
};

App.contentTemplateAddRow = function(){
  App.contentTemplateReadFromDOM();
  App.state.contentTemplate.push({ time: '20:00', title: '', type: '互动话题', note: '' });
  App._renderContentTemplateModal();
};

App.contentTemplateDelRow = function(idx){
  App.contentTemplateReadFromDOM();
  App.state.contentTemplate.splice(idx, 1);
  App._renderContentTemplateModal();
};

App.contentTemplateSave = function(){
  App.contentTemplateReadFromDOM();
  if(!App.state.contentTemplate.length){
    App.toast('模板不能为空', 'err'); return;
  }
  if(App.state.contentTemplate.some(t => !t.title)){
    App.toast('存在未填写标题的模板项', 'err'); return;
  }
  App.save();
  App.toast('内容模板已保存', 'ok');
  App.closeModal();
};

App.contentTemplateDeploy = function(){
  App.contentTemplateReadFromDOM();
  const tpl = App.state.contentTemplate;
  if(!tpl.length){ App.toast('模板不能为空', 'err'); return; }
  if(tpl.some(t => !t.title)){ App.toast('存在未填写标题的模板项', 'err'); return; }

  const scopeSel = document.getElementById('tpl-scope');
  const scope = scopeSel ? scopeSel.value : 'month';
  const targetDays = App._getTargetDays(scope);
  if(!targetDays.length){ App.toast('所选范围内没有比赛日', 'info'); return; }

  const overwrite = document.getElementById('tpl-overwrite').checked;
  let deployDays = targetDays;
  if(!overwrite){
    deployDays = targetDays.filter(ds => !App.state.content.some(c => c.date === ds));
  }
  if(!deployDays.length){
    App.toast(overwrite ? '没有可部署的比赛日' : '所有比赛日已有内容，取消勾选「覆盖」可跳过已有内容的日期', 'info', 5000);
    return;
  }

  const totalNew = deployDays.length * tpl.length;
  let removedCount = 0;
  if(overwrite){
    removedCount = App.state.content.filter(c => deployDays.includes(c.date)).length;
  }

  const scopeLabel = scopeSel
    ? scopeSel.options[scopeSel.selectedIndex].text.replace(/（\d+ 天）/, '').trim()
    : '所选范围';

  const msg = `确认向 ${deployDays.length} 个比赛日部署模板？\n\n` +
    `部署范围：${scopeLabel}\n` +
    `每 ${tpl.length} 条模板 × ${deployDays.length} 天 = ${totalNew} 条新内容` +
    (overwrite && removedCount ? `\n覆盖模式：将先删除这些比赛日的 ${removedCount} 条已有内容` : '') +
    `\n\n此操作可通过 ↶ 撤销恢复。`;
  if(!confirm(msg)) return;

  /* 保存模板到云端 */
  App.save();

  /* 推入历史，支持撤销 */
  App.pushHistory('content');

  /* 覆盖模式：先删除目标比赛日的已有内容 */
  if(overwrite){
    App.state.content = App.state.content.filter(c => !deployDays.includes(c.date));
  }

  /* 部署模板 */
  for(const ds of deployDays){
    for(const item of tpl){
      App.state.content.push({
        id: App.uid('C'),
        date: ds,
        time: item.time,
        title: item.title,
        type: item.type,
        status: 'planned',
        note: item.note || '',
        assigneeId: null
      });
    }
  }

  App.save();
  App.closeModal();
  App.toast('已部署模板到 ' + deployDays.length + ' 个比赛日（' + scopeLabel + '），新增 ' + totalNew + ' 条内容', 'ok', 5000);
  App.renderView();
};
