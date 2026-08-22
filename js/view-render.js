/* =====================================================
 * view-render.js — 图形工厂主 UI
 * 模板选择 + 模板管理(3.5) + 数据源 + 混合编辑器(拖拽+表单)
 * 参考线对齐(3.8.1) + 历史(撤销/重做/恢复默认/清空, 3.8.2)
 * 当日解说分配(7.4.1) + 批量出首发(7.6.3) + 文字微调(3.7)
 * 管理员槽位增删(3.4) + 缺素材横幅(5.2) + 中英双图/zip(4.0/5.1)
 * 使用 App.state.render.draftSlots 作为工作副本（不持久化）。
 * ===================================================== */

/* ---------- 工具 ---------- */
function rfClone(o){ return JSON.parse(JSON.stringify(o)); }
function rfTpl(){ return App.state.render.draftSlots; }
function rfYMD(date){ return (date||'').replace(/-/g, ''); }
function rfDayTeams(date){
  const day = App.state.scheduleDays[date];
  const ids = [];
  (day && day.matches || []).forEach(m => {
    const [a,b] = App.findTeamKey(m.teams || '');
    if(a && !ids.includes(a)) ids.push(a);
    if(b && !ids.includes(b)) ids.push(b);
  });
  return ids;
}

/* ---------- 进入渲染视图 ---------- */
App.renderRender = function(){
  if(!App.state.render) App.state.render = { currentTemplateId:null, currentSource:null, draftSlots:null, overrides:{} };
  const tpls = App.state.templates || [];
  let tpl = rfTpl();
  if(!tpl || App.state.render.currentTemplateId == null){
    const first = tpls[0];
    if(first){ App.rfSelectTemplate(first.id, true); tpl = rfTpl(); }
  }
  const isAdmin = App.can('manage');
  const list = tpls.map(t => `<option value="${t.id}" ${t.id===App.state.render.currentTemplateId?'selected':''}>${escHtml(t.name)}</option>`).join('');
  const kind = tpl ? tpl.kind : '';
  const dateVal = (App.state.render.currentSource && App.state.render.currentSource.kind==='date') ? App.state.render.currentSource.value : D.today();
  const teamVal = (App.state.render.currentSource && App.state.render.currentSource.kind==='team') ? App.state.render.currentSource.value : '';

  return `
  <div class="rf-head">
    <h2>图形工厂 <small>底图 + 赛程 → 产出图（中英双语）</small></h2>
  </div>

  <div class="rf-top">
    <div class="form-row"><label>模板</label>
      <select onchange="App.rfSelectTemplate(this.value)">${list || '<option>（暂无模板）</option>'}</select>
    </div>
    ${isAdmin ? `
    <div class="toolbar">
      <button class="btn" onclick="App.rfNewTemplate()">＋ 新建</button>
      <button class="btn" onclick="App.rfCloneTemplate()">⧉ 克隆</button>
      <button class="btn" onclick="App.rfRenameTemplate()">✎ 重命名</button>
      <button class="btn danger" onclick="App.rfDeleteTemplate()">🗑 删除</button>
      <button class="btn ${App._rf&&App._rf.mode==='edit'?'primary':''}" onclick="App.rfToggleEdit()">${App._rf&&App._rf.mode==='edit'?'✓ 编辑结构(开)':'✎ 编辑结构'}</button>
      <button class="btn" onclick="App.rfSaveTemplate()">💾 保存模板</button>
    </div>` : ''}
    <div class="toolbar">
      <button class="btn" onclick="App.rfUndo()" ${App.canUndo('render')?'':'disabled'}>↶ 撤销</button>
      <button class="btn" onclick="App.rfRedo()" ${App.canRedo('render')?'':'disabled'}>↷ 重做</button>
      <button class="btn" onclick="App.rfReset()">⟲ 恢复默认</button>
      <button class="btn" onclick="App.rfClear()">🧹 清空</button>
    </div>
  </div>

  ${tpl ? `
  <div class="rf-body">
    <div class="rf-left">
      <!-- 数据源 -->
      <div class="card rf-src">
        <h3>数据源</h3>
        ${kind==='lineup' ? `
          <div class="form-row"><label>日期（北京时间）</label>
            <input type="date" value="${dateVal}" onchange="App.rfSetDate(this.value)"></div>
          <div class="hint">当日上场队伍（勾选要出的首发）：</div>
          <div class="rf-teams">${rfTeamChecks(dateVal)}</div>
        ` : `
          <div class="form-row"><label>日期（北京时间）</label>
            <input type="date" value="${dateVal}" onchange="App.rfSetDate(this.value)"></div>
          ${kind==='casters' ? `<div class="rf-casters">${rfCasterAssign(dateVal)}</div>` : ''}
        `}
      </div>

      <!-- 预览 -->
      <div class="card rf-preview">
        <h3>预览 <small id="rf-prev-lang">${(App._rf&&App._rf.lang)||'zh'}</small>
          ${isAdmin&&App._rf&&App._rf.mode==='edit' ? `
            <label class="rf-chk"><input type="checkbox" ${App._rf&&App._rf.grid?'checked':''} onchange="App.rfToggleGrid(this.checked)"> 网格吸附(10px)</label>` : ''}
        </h3>
        <div id="rf-banner"></div>
        <div class="rf-canvas-wrap"><canvas id="rf-canvas"></canvas></div>
      </div>
    </div>

    <!-- 槽位检查器 -->
    <div class="rf-right">
      <div class="card">
        <h3>槽位 <small>${tpl.slots.length} 个</small>
          ${isAdmin ? `<button class="btn sm" onclick="App.rfAddSlot()">＋ 槽位</button>` : ''}</h3>
        <div class="rf-slotlist">${rfSlotList(tpl, isAdmin)}</div>
      </div>
      <div class="card" id="rf-inspect">${rfInspector(tpl, isAdmin)}</div>
    </div>
  </div>

  <!-- 导出 -->
  <div class="rf-export card">
    <h3>导出</h3>
    <div class="toolbar">
      <label class="rf-chk">语言：
        <select id="rf-langsel">
          <option value="both" ${tpl.lang.length>1?'selected':''}>中英双图</option>
          <option value="zh" ${tpl.lang.indexOf('zh')>=0&&tpl.lang.length===1?'selected':''}>仅中文</option>
          <option value="en" ${tpl.lang.indexOf('en')>=0&&tpl.lang.length===1?'selected':''}>仅英文</option>
        </select>
      </label>
      ${isAdmin ? `<label class="rf-chk">分辨率：<select id="rf-scalesel">
          <option value="1" ${App.rfScale()==1?'selected':''}>1x</option>
          <option value="2" ${App.rfScale()==2?'selected':''}>2x</option>
          <option value="3" ${App.rfScale()==3?'selected':''}>3x</option>
          <option value="1.5" ${App.rfScale()==1.5?'selected':''}>1.5x</option>
        </select></label>` : `<span class="hint">分辨率：${App.rfScale()}x（管理员可改）</span>`}
      <button class="btn primary" onclick="App.rfExportPNG()">⬇ 导出${(tpl.lang&&tpl.lang.length>1)?'中英双图':'图片'}</button>
      <button class="btn" onclick="App.rfExportZip()">🗜 打包 ZIP</button>
    </div>
    <div class="hint" id="rf-export-hint"></div>
  </div>
  ` : '<div class="empty">请先新建或选择模板</div>'}
  `;
};

/* ---------- 数据源子组件 ---------- */
function rfTeamChecks(date){
  const ids = rfDayTeams(date);
  const sel = (App.state.render.currentSource && App.state.render.currentSource.kind==='team') ? App.state.render.currentSource.value : (ids[0]||'');
  if(!ids.length) return '<div class="empty">当日无比赛 / 无队伍</div>';
  return ids.map(id => {
    const t = App.state.teams[id];
    const checked = App._rf && App._rf.teams && App._rf.teams.includes(id) ? 'checked' : (App._rf && App._rf.teams ? '' : 'checked');
    return `<label class="rf-tc"><input type="checkbox" value="${id}" ${checked} onchange="App.rfToggleTeam('${id}',this.checked)"> ${t?escHtml(t.shortName):id}</label>`;
  }).join('');
}
function rfCasterAssign(date){
  const day = App.state.scheduleDays[date];
  const matches = (day && day.matches) || [];
  const pool = App.state.casters || [];
  if(!matches.length) return '<div class="empty">当日无比赛</div>';
  return matches.map((m, i) => {
    const [a,b] = App.findTeamKey(m.teams||'');
    const ta = a?App.state.teams[a]:null, tb = b?App.state.teams[b]:null;
    const assigned = m.casterIds || [];
    const opts = pool.map(c => `<label class="rf-tc"><input type="checkbox" value="${c.id}" ${assigned.includes(c.id)?'checked':''} onchange="App.rfToggleCaster(${i},'${c.id}',this.checked)"> ${escHtml(c.name||'未命名')}<small>${escHtml(c.role||'')}</small></label>`).join('');
    return `<div class="rf-match"><b>${ta?escHtml(ta.shortName):'?'} vs ${tb?escHtml(tb.shortName):'?'}</b> <span class="muted">${m.time}</span><div class="rf-caster-pool">${opts||'<span class="muted">解说池为空，请到素材后台录入</span>'}</div></div>`;
  }).join('');
}
function rfSlotList(tpl, isAdmin){
  return tpl.slots.map(s => {
    const editable = s.editable ? ' <span class="tag ok">可改</span>' : '';
    const sys = s.createdBy==='admin' ? ' <span class="tag">自定义</span>' : '';
    return `<div class="rf-slot ${App._rf&&App._rf.sel===s.key?'active':''}" onclick="App.rfSelectSlot('${s.key}')">
      <span class="rf-sk">${escHtml(s.key)}</span> <span class="muted">${s.type}/${s.group||'static'}</span>${editable}${sys}
      ${isAdmin?`<button class="btn sm danger" onclick="event.stopPropagation();App.rfDeleteSlot('${s.key}')">删</button>`:''}
    </div>`;
  }).join('');
}
function rfInspector(tpl, isAdmin){
  const key = App._rf && App._rf.sel;
  const s = key && tpl.slots.find(x => x.key===key);
  if(!s) return '<div class="empty">选择一个槽位查看 / 编辑</div>';
  const isImg = s.type==='image';
  return `
    <h3>槽位：${escHtml(s.key)}</h3>
    ${isAdmin?`
    <div class="rf-form">
      <div class="rf-fr"><label>x</label><input type="number" value="${s.x}" oninput="App.rfSetSlot('${s.key}','x',+this.value)"></div>
      <div class="rf-fr"><label>y</label><input type="number" value="${s.y}" oninput="App.rfSetSlot('${s.key}','y',+this.value)"></div>
      <div class="rf-fr"><label>宽</label><input type="number" value="${s.w}" oninput="App.rfSetSlot('${s.key}','w',+this.value)"></div>
      <div class="rf-fr"><label>高</label><input type="number" value="${s.h}" oninput="App.rfSetSlot('${s.key}','h',+this.value)"></div>
      <div class="rf-fr"><label>来源</label><input value="${escAttr(s.source||'')}" onchange="App.rfSetSlot('${s.key}','source',this.value)"></div>
      ${isImg?`<div class="rf-fr"><label>遮罩</label><select onchange="App.rfSetSlot('${s.key}','shape',this.value)">${['rect','circle','arch','rounded'].map(o=>`<option ${s.shape===o?'selected':''}>${o}</option>`).join('')}</select></div>`
      :`<div class="rf-fr"><label>字号</label><input type="number" value="${s.size||28}" oninput="App.rfSetSlot('${s.key}','size',+this.value)"></div>
        <div class="rf-fr"><label>颜色</label><input type="color" value="${s.color||'#ffffff'}" oninput="App.rfSetSlot('${s.key}','color',this.value)"></div>
        <div class="rf-fr"><label>对齐</label><select onchange="App.rfSetSlot('${s.key}','align',this.value)">${['left','center','right'].map(o=>`<option ${s.align===o?'selected':''}>${o}</option>`).join('')}</select></div>
        <div class="rf-fr"><label>字体</label><input value="${escAttr(s.font||'')}" onchange="App.rfSetSlot('${s.key}','font',this.value)"></div>
        <div class="rf-fr"><label>固定文</label><input value="${escAttr(s.staticText||'')}" onchange="App.rfSetSlot('${s.key}','staticText',this.value)"></div>`}
      <label class="rf-chk"><input type="checkbox" ${s.editable?'checked':''} onchange="App.rfSetSlot('${s.key}','editable',this.checked)"> 运营可微调</label>
    </div>`:''}
    ${(!isAdmin && s.editable) ? `
    <div class="rf-form">
      <div class="rf-fr"><label>微调文字</label><input value="${escAttr((App.state.render.overrides[s.key]&&App.state.render.overrides[s.key].text)!=null?(App.state.render.overrides[s.key].text):'')}" placeholder="${escAttr(s.staticText||'')}" oninput="App.rfSetOverride('${s.key}','text',this.value)"></div>
      <div class="rf-fr"><label>字号</label><input type="number" value="${(App.state.render.overrides[s.key]&&App.state.render.overrides[s.key].size)!=null?(App.state.render.overrides[s.key].size):(s.size||28)}" oninput="App.rfSetOverride('${s.key}','size',+this.value)"></div>
      <div class="rf-fr"><label>颜色</label><input type="color" value="${(App.state.render.overrides[s.key]&&App.state.render.overrides[s.key].color)||s.color||'#ffffff'}" oninput="App.rfSetOverride('${s.key}','color',this.value)"></div>
      <div class="rf-fr"><label>对齐</label><select onchange="App.rfSetOverride('${s.key}','align',this.value)">${['left','center','right'].map(o=>`<option ${((App.state.render.overrides[s.key]&&App.state.render.overrides[s.key].align)||s.align||'left')===o?'selected':''}>${o}</option>`).join('')}</select></div>
    </div>`:''}
  `;
}

/* ---------- 选择 / 切换模板 ---------- */
App.rfSelectTemplate = function(id, silent){
  const tpl = (App.state.templates||[]).find(t => t.id===id);
  if(!tpl) return;
  App.state.render.currentTemplateId = id;
  App.state.render.draftSlots = rfClone(tpl);
  App.state.render.overrides = {};
  const date = D.today();
  if(tpl.kind==='lineup'){
    const ids = rfDayTeams(date);
    App._rf = { mode:'preview', sel:null, grid:true, lang:'zh', teams: ids.slice() };
    App.state.render.currentSource = { kind:'team', value: ids[0]||'', date };
  } else {
    App._rf = { mode:'preview', sel:null, grid:true, lang:'zh' };
    App.state.render.currentSource = { kind:'date', value: date };
  }
  if(!silent) App.renderView();
};

App.rfScale = function(){
  const tpl = rfTpl();
  const sel = App._rf && App._rf.scale;
  return sel || (tpl && tpl.exportScale) || 1;
};

/* ---------- 数据源操作 ---------- */
App.rfSetDate = function(date){
  if(!App.state.render.currentSource) App.state.render.currentSource = {};
  App.state.render.currentSource.kind = (rfTpl() && rfTpl().kind==='lineup') ? 'team' : 'date';
  App.state.render.currentSource.value = date;
  if(rfTpl() && rfTpl().kind==='lineup'){
    const ids = rfDayTeams(date);
    App._rf.teams = ids.slice();
    App.state.render.currentSource.value = ids[0]||'';
    App.state.render.currentSource.date = date;
  }
  App.renderView();
};
App.rfToggleTeam = function(id, on){
  App._rf.teams = App._rf.teams || [];
  if(on){ if(!App._rf.teams.includes(id)) App._rf.teams.push(id); }
  else App._rf.teams = App._rf.teams.filter(x => x!==id);
};
App.rfToggleCaster = function(matchIdx, cid, on){
  const date = App.state.render.currentSource.value;
  const day = App.state.scheduleDays[date];
  if(!day || !day.matches[matchIdx]) return;
  const m = day.matches[matchIdx];
  m.casterIds = m.casterIds || [];
  if(on){ if(!m.casterIds.includes(cid)) m.casterIds.push(cid); }
  else m.casterIds = m.casterIds.filter(x => x!==cid);
  App.save();
  App.rfDraw();
};

/* ---------- 编辑器状态 ---------- */
App.rfToggleEdit = function(){
  if(!App.can('manage')){ App.toast('仅管理员可编辑模板结构','err'); return; }
  App._rf.mode = App._rf.mode==='edit' ? 'preview' : 'edit';
  App.renderView();
};
App.rfToggleGrid = function(on){ App._rf.grid = on; App.rfDraw(); };
App.rfSelectSlot = function(key){ App._rf.sel = key; App.renderView(); };
App.rfSetSlot = function(key, field, val){
  const s = rfTpl().slots.find(x => x.key===key); if(!s) return;
  if(['x','y','w','h','size'].includes(field)) val = +val;
  s[field] = val;
  App.rfDraw();
};
App.rfSetOverride = function(key, field, val){
  App.pushHistory('render');
  App.state.render.overrides[key] = App.state.render.overrides[key] || {};
  if(['size'].includes(field)) val = +val;
  App.state.render.overrides[key][field] = val;
  App.rfDraw();
};

/* ---------- 历史 ---------- */
App.rfUndo = function(){ if(App.undoSection('render')){ App.renderView(); } };
App.rfRedo = function(){ if(App.redoSection('render')){ App.renderView(); } };
App.rfReset = function(){
  const id = App.state.render.currentTemplateId;
  const orig = (App.state.templates||[]).find(t => t.id===id);
  if(!orig){ App.toast('未找到原始模板','err'); return; }
  App.pushHistory('render');
  App.state.render.draftSlots = rfClone(orig);
  App.state.render.overrides = {};
  App.renderView();
};
App.rfClear = function(){
  App.pushHistory('render');
  App.state.render.draftSlots = rfClone((App.state.templates||[]).find(t=>t.id===App.state.render.currentTemplateId) || App.state.render.draftSlots);
  App.state.render.overrides = {};
  App.renderView();
};

/* ---------- 管理员：槽位增删 (3.4) ---------- */
App.rfAddSlot = function(){
  if(!App.can('manage')){ App.toast('仅管理员可增删槽位','err'); return; }
  App.modal('新增槽位', `
    <div class="form-row"><label>key</label><input id="ns-key" placeholder="custom_xxx"></div>
    <div class="form-row"><label>类型</label><select id="ns-type"><option value="text">文字</option><option value="image">图片</option></select></div>
    <div class="form-row"><label>分组</label><select id="ns-group"><option value="static">static(单次)</option><option value="match">match(比赛)</option><option value="player">player(选手)</option><option value="coach">coach(教练)</option><option value="caster">caster(解说)</option></select></div>
    <div class="form-row"><label>来源路径</label><input id="ns-source" placeholder="matches[i].teamA.logo 或 literal"></div>
    <div class="form-row"><label>固定文字(literal时)</label><input id="ns-text" placeholder="VS"></div>
    <div class="form-row"><label>坐标 x,y,w,h</label>
      <input id="ns-x" type="number" value="100" style="width:60px"> <input id="ns-y" type="number" value="100" style="width:60px">
      <input id="ns-w" type="number" value="200" style="width:60px"> <input id="ns-h" type="number" value="60" style="width:60px"></div>
    <div class="hint">保存后请在右侧检查器微调坐标与样式</div>
  `, `<button class="btn" onclick="App.closeModal()">取消</button>
      <button class="btn primary" onclick="App.rfAddSlotConfirm()">添加</button>`);
};
App.rfAddSlotConfirm = function(){
  const key = document.getElementById('ns-key').value.trim();
  if(!key){ App.toast('请填写 key','err'); return; }
  if(rfTpl().slots.some(s => s.key===key)){ App.toast('key 已存在','err'); return; }
  App.pushHistory('render');
  rfTpl().slots.push({
    key, type: document.getElementById('ns-type').value,
    group: document.getElementById('ns-group').value,
    x:+document.getElementById('ns-x').value, y:+document.getElementById('ns-y').value,
    w:+document.getElementById('ns-w').value, h:+document.getElementById('ns-h').value,
    source: document.getElementById('ns-source').value.trim() || 'literal',
    staticText: document.getElementById('ns-text').value,
    shape: 'rect', font:'Noto Sans SC', size:30, color:'#ffffff', align:'center',
    editable:true, createdBy:'admin'
  });
  App.closeModal(); App.renderView();
};
App.rfDeleteSlot = function(key){
  if(!App.can('manage')){ App.toast('仅管理员可删除槽位','err'); return; }
  const s = rfTpl().slots.find(x => x.key===key);
  if(s && s.createdBy!=='admin'){ if(!confirm('内置槽位删除后需重新添加，确认？')) return; }
  App.pushHistory('render');
  rfTpl().slots = rfTpl().slots.filter(x => x.key!==key);
  App.renderView();
};

/* ---------- 管理员：模板管理 (3.5) ---------- */
App.rfNewTemplate = function(){
  if(!App.can('manage')){ App.toast('仅管理员可管理模板','err'); return; }
  App.modal('新建模板', `
    <div class="form-row"><label>名称</label><input id="nt-name" placeholder="如：赛事海报 A"></div>
    <div class="form-row"><label>方向</label><select id="nt-orient"><option value="portrait">竖版</option><option value="landscape">横版</option></select></div>
    <div class="form-row"><label>设计尺寸 w,h</label>
      <input id="nt-w" type="number" value="1080" style="width:90px"> <input id="nt-h" type="number" value="1080" style="width:90px"></div>
    <div class="form-row"><label>类型</label><select id="nt-kind"><option value="preview">今日预告</option><option value="casters">今日解说</option><option value="lineup">今日首发</option><option value="custom">自定义</option></select></div>
    <div class="form-row"><label>底图(可选)</label><input type="file" id="nt-base" accept="image/*"></div>
  `, `<button class="btn" onclick="App.closeModal()">取消</button>
      <button class="btn primary" onclick="App.rfNewTemplateConfirm()">创建并编辑</button>`);
};
App.rfNewTemplateConfirm = async function(){
  const name = document.getElementById('nt-name').value.trim() || '未命名模板';
  const w = +document.getElementById('nt-w').value, h = +document.getElementById('nt-h').value;
  const orient = document.getElementById('nt-orient').value;
  const kind = document.getElementById('nt-kind').value;
  let base = '';
  const file = document.getElementById('nt-base').files[0];
  if(file){
    try{ base = await ASSETS.upload(file, 'templates'); }catch(e){ App.toast('底图上传失败：'+e.message,'err'); }
  }
  const id = 'tpl_' + Date.now().toString(36);
  const tpl = { id, name, kind, orientation: orient, size:{w,h}, exportScale:1, base,
    lang:['zh','en'], createdBy:'admin', groups:{}, slots:[],
    meta:{ title:name, titleEn:name, subtitle:'', subtitleEn:'' },
    createdAt: Date.now(), updatedAt: Date.now() };
  App.state.templates.push(tpl);
  App.closeModal();
  App.rfSelectTemplate(id);
  App._rf.mode = 'edit';
  App.renderView();
  App.toast('已创建空模板，进入编辑结构模式','ok');
};
App.rfCloneTemplate = function(){
  if(!App.can('manage')){ App.toast('仅管理员可管理模板','err'); return; }
  const tpl = rfTpl(); if(!tpl) return;
  const id = 'tpl_' + Date.now().toString(36);
  const copy = rfClone(tpl);
  copy.id = id; copy.name = tpl.name + ' 副本'; copy.createdBy='admin'; copy.createdAt=Date.now(); copy.updatedAt=Date.now();
  App.state.templates.push(copy);
  App.rfSelectTemplate(id);
  App.toast('已克隆模板','ok');
};
App.rfRenameTemplate = function(){
  if(!App.can('manage')){ App.toast('仅管理员可管理模板','err'); return; }
  const tpl = rfTpl(); if(!tpl) return;
  App.modal('重命名模板', `<div class="form-row"><label>名称</label><input id="rn-name" value="${escAttr(tpl.name)}"></div>`,
    `<button class="btn" onclick="App.closeModal()">取消</button><button class="btn primary" onclick="App.rfRenameConfirm()">保存</button>`);
};
App.rfRenameConfirm = function(){
  const name = document.getElementById('rn-name').value.trim();
  if(name) rfTpl().name = name;
  App.closeModal(); App.renderView();
};
App.rfDeleteTemplate = function(){
  if(!App.can('manage')){ App.toast('仅管理员可管理模板','err'); return; }
  const id = App.state.render.currentTemplateId;
  if(!id) return;
  if(!confirm('确认删除该模板？此操作不可撤销。')) return;
  App.state.templates = App.state.templates.filter(t => t.id!==id);
  App.state.render.currentTemplateId = (App.state.templates[0]||{}).id || null;
  App.state.render.draftSlots = null;
  App.save();
  App.renderView();
  App.toast('模板已删除','ok');
};
App.rfSaveTemplate = function(){
  if(!App.can('manage')){ App.toast('仅管理员可保存模板','err'); return; }
  const draft = rfTpl(); if(!draft) return;
  draft.updatedAt = Date.now();
  const idx = (App.state.templates||[]).findIndex(t => t.id===draft.id);
  if(idx>=0) App.state.templates[idx] = rfClone(draft);
  else App.state.templates.push(rfClone(draft));
  App.save();
  App.toast('模板已保存并同步','ok');
};

/* ---------- 预览绘制 ---------- */
App.rfDraw = function(){
  const canvas = document.getElementById('rf-canvas');
  if(!canvas) return;
  const tpl = rfTpl(); if(!tpl) return;
  const wrap = canvas.parentElement;
  const maxW = Math.max(320, wrap.clientWidth - 24);
  const disp = Math.min(maxW / tpl.size.w, 1.2);
  App._rf = App._rf || {};
  App._rf.disp = disp;
  canvas.width = Math.round(tpl.size.w * disp);
  canvas.height = Math.round(tpl.size.h * disp);
  const c = canvas.getContext('2d');
  c.setTransform(1,0,0,1,0,0);
  c.clearRect(0,0,canvas.width,canvas.height);
  // 背景
  c.fillStyle = '#0e0a0b'; c.fillRect(0,0,canvas.width,canvas.height);

  const source = App.state.render.currentSource;
  const lang = App._rf.lang || 'zh';
  const ov = App.state.render.overrides;

  // 引擎渲染（以 disp 作为 scale 预览）
  RENDER.renderTemplate(tpl, source, { scale: disp, lang, overrides: ov }).then(res => {
    c.drawImage(res.canvas, 0, 0);
    // 槽位叠加（编辑模式）
    if(App._rf.mode==='edit'){
      const { instances } = RENDER.instances(tpl, res.ctx);
      instances.forEach(inst => {
        c.save();
        c.strokeStyle = (App._rf.sel===inst.slot.key) ? '#FD2659' : (inst.slot.editable ? 'rgba(77,127,204,.9)' : 'rgba(160,160,160,.5)');
        c.lineWidth = (App._rf.sel===inst.slot.key) ? 2 : 1;
        c.strokeRect(inst.x*disp, inst.y*disp, inst.w*disp, inst.h*disp);
        c.restore();
      });
      // 网格
      if(App._rf.grid){
        c.save(); c.strokeStyle='rgba(255,255,255,.08)'; c.lineWidth=1;
        for(let x=0;x<=tpl.size.w;x+=10){ c.beginPath(); c.moveTo(x*disp,0); c.lineTo(x*disp,canvas.height); c.stroke(); }
        for(let y=0;y<=tpl.size.h;y+=10){ c.beginPath(); c.moveTo(0,y*disp); c.lineTo(canvas.width,y*disp); c.stroke(); }
        c.restore();
      }
    }
    // 缺素材横幅
    const banner = document.getElementById('rf-banner');
    if(banner){
      if(res.missing.length){
        banner.innerHTML = `<div class="rf-missing">⚠ 缺失素材（禁止导出残图）：<br>${res.missing.map(m=>escHtml(m.label)).join('；')}</div>`;
      } else banner.innerHTML = '';
    }
    const hint = document.getElementById('rf-export-hint');
    if(hint) hint.innerHTML = res.missing.length ? '存在缺失素材，导出按钮已禁用。请到「素材管理」补全。' : '素材齐全，可导出。';
    const btn = document.querySelector('.rf-export .btn.primary');
    if(btn) btn.disabled = res.missing.length>0;
  }).catch(e => { console.error(e); });
};

/* ---------- 拖拽（编辑结构模式，管理员） ---------- */
(function(){
  let drag = null;
  document.addEventListener('mousedown', e => {
    const cv = document.getElementById('rf-canvas');
    if(!cv || !App._rf || App._rf.mode!=='edit' || !App.can('manage')) return;
    if(e.target !== cv) return;
    const rect = cv.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / App._rf.disp;
    const my = (e.clientY - rect.top) / App._rf.disp;
    const tpl = rfTpl();
    // 命中测试（优先后添加的）
    let hit = null;
    for(let i=tpl.slots.length-1;i>=0;i--){
      const s = tpl.slots[i];
      if(mx>=s.x && mx<=s.x+s.w && my>=s.y && my<=s.y+s.h){ hit = s; break; }
    }
    if(hit){
      drag = { key:hit.key, sx:hit.x, sy:hit.y, ox:e.clientX, oy:e.clientY, moved:false };
      App._rf.sel = hit.key;
    }
  });
  document.addEventListener('mousemove', e => {
    if(!drag) return;
    const dx = (e.clientX - drag.ox) / App._rf.disp;
    const dy = (e.clientY - drag.oy) / App._rf.disp;
    let nx = drag.sx + dx, ny = drag.sy + dy;
    const tpl = rfTpl();
    const s = tpl.slots.find(x=>x.key===drag.key); if(!s) return;
    // 网格吸附
    if(App._rf.grid){ nx = Math.round(nx/10)*10; ny = Math.round(ny/10)*10; }
    // 边缘智能参考线（与其它槽位对齐）
    let snapped = false;
    for(const o of tpl.slots){
      if(o.key===drag.key) continue;
      [o.x, o.x+o.w/2, o.x+o.w].forEach(ox => {
        if(Math.abs(nx - ox) < 3){ nx = ox; snapped = true; }
        if(Math.abs(nx+s.w - ox) < 3){ nx = ox - s.w; snapped = true; }
      });
      [o.y, o.y+o.h/2, o.y+o.h].forEach(oy => {
        if(Math.abs(ny - oy) < 3){ ny = oy; snapped = true; }
        if(Math.abs(ny+s.h - oy) < 3){ ny = oy - s.h; snapped = true; }
      });
      if(snapped) break;
    }
    s.x = Math.round(nx); s.y = Math.round(ny);
    drag.moved = true;
    App.rfDraw();
  });
  document.addEventListener('mouseup', () => {
    if(drag && drag.moved){ App.pushHistory('render'); }
    drag = null;
  });
})();

/* ---------- 导出 ---------- */
App.rfExportName = function(tpl, source, lang){
  const base = tpl.name.replace(/[\\/:*?"<>|]/g,'_');
  const ds = source.kind==='team'
    ? (App.state.teams[source.value] ? App.state.teams[source.value].shortName : source.value)
    : (source.value||'');
  return `${base}_${ds}_${lang}_${rfYMD(source.date||(source.kind==='date'?source.value:D.today()))}`;
};
App.rfJobs = function(tpl){
  const langSel = (document.getElementById('rf-langsel')||{}).value || 'both';
  const source = App.state.render.currentSource;
  const jobs = [];
  const langs = langSel==='both' ? tpl.lang.slice() : [langSel];
  if(tpl.kind==='lineup'){
    const teams = (App._rf.teams && App._rf.teams.length) ? App._rf.teams : [source.value];
    teams.forEach(tid => {
      langs.forEach(l => jobs.push({ source:{ kind:'team', value:tid, date: source.date||D.today() }, lang:l, name: App.rfExportName(tpl, {kind:'team',value:tid,date:source.date}, l) }));
    });
  } else {
    langs.forEach(l => jobs.push({ source:{ kind:'date', value: source.value }, lang:l, name: App.rfExportName(tpl, source, l) }));
  }
  return jobs;
};
App.rfExportPNG = async function(){
  const tpl = rfTpl(); if(!tpl) return;
  const jobs = App.rfJobs(tpl);
  const scale = App.rfScale();
  App.toast('正在渲染 '+jobs.length+' 张…','info', 2000);
  const items = await RENDER.batchRender(tpl, jobs, { scale, overrides: App.state.render.overrides }, (d,t)=>{ App.toast('渲染 '+d+'/'+t,'info',800); });
  items.forEach(it => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(it.blob);
    a.download = it.name + '.png';
    document.body.appendChild(a); a.click(); a.remove();
  });
  App.toast('已导出 '+items.length+' 张 PNG','ok');
};
App.rfExportZip = async function(){
  const tpl = rfTpl(); if(!tpl) return;
  const jobs = App.rfJobs(tpl);
  const scale = App.rfScale();
  App.toast('正在打包 '+jobs.length+' 张…','info', 2000);
  const items = await RENDER.batchRender(tpl, jobs, { scale, overrides: App.state.render.overrides }, (d,t)=>App.toast('渲染 '+d+'/'+t,'info',800));
  try{
    const zip = await RENDER.exportZip(items.map(it=>({ blob:it.blob, name: it.name+'.png' })), tpl.name+'.zip');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(zip);
    a.download = tpl.name + '_' + rfYMD(D.today()) + '.zip';
    document.body.appendChild(a); a.click(); a.remove();
    App.toast('已打包 ZIP','ok');
  }catch(e){ App.toast('打包失败：'+e.message,'err'); }
};
