/* =====================================================
 * view-schedule.js — 赛程管理（日历视图 + 官方同步 + 手动修正）
 * ===================================================== */

App.renderSchedule = function(){
  const st = App.state;
  const isAdmin = App.can('manage');
  const monthStr = App.ui.scheduleMonth || D.today().slice(0, 7);
  const { y, m } = D.ym(monthStr + '-01');

  // 日历网格
  const first = D.parse(monthStr + '-01');
  const lead = (first.getDay() + 6) % 7;           // 周一开头
  const days = D.monthDays(y, m);
  let cells = '';
  for(let i=0;i<lead;i++) cells += '<div class="cal-cell other"></div>';
  for(const ds of days){
    const info = st.scheduleDays[ds];
    const type = info ? info.type : 'rest';
    const isToday = ds === D.today();
    const cls = 'cal-cell' + (isAdmin ? ' clickable' : '') + (isToday ? ' today' : '');
    let inner = `<div class="dline"><span class="dnum">${D.parse(ds).getDate()}</span>
      <span class="badge ${type}">${type === 'match' ? '赛' : '休'}${info && info.manual ? '·手' : ''}</span></div>`;
    if(type === 'match' && info){
      info.matches.forEach(mt => {
        inner += `<div class="match-line"><b>${mt.time}</b> ${mt.teams} <span class="hint">${mt.bo||''}</span></div>`;
      });
      inner += `<div class="hint" style="margin-top:3px">${info.matches[0] ? info.matches[0].stage : ''}</div>`;
    }
    cells += `<div class="${cls}" ${isAdmin ? `onclick="App.scheduleDayOpen('${ds}')"` : ''}>${inner}</div>`;
  }

  // 同步日志
  const logs = st.syncLog.slice(0, 4).map(l => {
    const t = new Date(l.time);
    const tstr = (t.getMonth()+1) + '/' + t.getDate() + ' ' + String(t.getHours()).padStart(2,'0') + ':' + String(t.getMinutes()).padStart(2,'0');
    const detail = l.changes.length
      ? l.changes.map(c => D.dateCN(c.date) + ' ' + c.desc).join('；')
      : (l.note || '无变更');
    const flag = l.affected ? ` <span class="warn-txt">（${l.affected} 天已排班受影响，建议重新排班）</span>` : '';
    return `<div class="log-item">[${tstr}] ${detail}${flag}</div>`;
  }).join('');

  return `
  <div class="card">
    <h3><span class="left">官方赛程 <span class="hint">数据源：VLR.gg 自动抓取 · 每日 6:00 更新</span></span></h3>
    <div class="toolbar">
      <input type="month" value="${monthStr}" style="width:150px" onchange="App.ui.scheduleMonth=this.value;App.renderView()">
      <button class="btn primary" id="btn-sync" onclick="App.doSync()">⟳ 同步官方赛程</button>
      <span class="hint">上次同步：${fmtSyncTime(st.lastSync)} · 已同步 ${st.remoteRev} 次${st.syncLog[0] && st.syncLog[0].source === 'vlr' ? '（VLR）' : ''}</span>
      <div class="spacer"></div>
      ${isAdmin ? `<div class="undo-group">
        <button class="btn sm" onclick="App.undoSchedule()" ${!App.canUndo('schedule')?'disabled':''} title="撤销上次操作">↶ 撤销</button>
        <button class="btn sm" onclick="App.redoSchedule()" ${!App.canRedo('schedule')?'disabled':''} title="重做">↷ 重做</button>
        <button class="btn sm" onclick="App.resetSchedule()" ${!App.canReset('schedule')?'disabled':''} title="重置到进入页面时的状态">↺ 重置</button>
      </div>
      <button class="btn sm danger" onclick="App.clearSchedule()" title="清空当月全部赛程数据">🗑 清空</button>` : ''}
      <span class="legend">
        <span><i class="lg-match"></i>比赛日</span>
        <span><i class="lg-rest"></i>休赛日</span>
        <span><i style="background:rgba(229,174,21,.5)"></i>手动修正（同步不覆盖）</span>
      </span>
    </div>
    ${isAdmin ? '<div class="hint" style="margin:-6px 0 12px">管理员：点击日历中的日期可手动修正赛程（设为比赛日/休赛日、编辑场次）。手动修正不会被官方同步覆盖。</div>' : ''}
    <div class="cal-head">${['一','二','三','四','五','六','日'].map(w=>`<div>${w}</div>`).join('')}</div>
    <div class="cal">${cells}</div>
  </div>
  <div class="card">
    <h3><span class="left">同步日志</span></h3>
    <div class="sync-log">${logs || '<div class="empty">暂无日志</div>'}</div>
  </div>`;
};

function fmtSyncTime(t){
  if(!t) return '从未';
  const d = new Date(t);
  return (d.getMonth()+1) + '月' + d.getDate() + '日 ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

App.doSync = async function(){
  const btn = document.getElementById('btn-sync');
  if(btn){ btn.disabled = true; btn.textContent = '正在抓取 VLR 赛程…'; }
  App.pushHistory('schedule');
  const { changes, affected } = await App.syncSchedule();
  if(!changes.length){
    App.toast('VLR 赛程已是最新，无变更', 'ok');
  } else {
    App.toast(`检测到 ${changes.length} 项官方赛程变更：` + changes.map(c => D.dateCN(c.date) + c.desc).join('；'), 'ok');
    if(affected.length){
      App.toast(`⚠️ ${affected.length} 个已排班日受赛程变更影响，建议前往「排班管理」重新排班并检测冲突`, 'warn', 6000);
      affected.forEach(c => App.state.user && App.can('manage') && null);
    }
  }
  App.renderView();
};

/* ---------- 单日修正弹窗（管理员） ---------- */
App.scheduleDayOpen = function(date){
  if(!App.can('manage')) return;
  const info = App.state.scheduleDays[date] || { type:'rest', manual:false, matches:[] };
  App._editDay = { date, info: JSON.parse(JSON.stringify(info)) };
  App.renderScheduleModal();
};

App.renderScheduleModal = function(){
  const { date, info } = App._editDay;
  const matchesHTML = info.matches.map((mt, i) => `
    <div class="toolbar" style="margin-bottom:8px">
      <input type="time" value="${mt.time}" style="width:100px" onchange="App._editDay.info.matches[${i}].time=this.value">
      <input value="${mt.teams||''}" placeholder="对阵，如 TES vs WBG" onchange="App._editDay.info.matches[${i}].teams=this.value">
      <input value="${mt.stage||''}" placeholder="阶段" style="width:120px" onchange="App._editDay.info.matches[${i}].stage=this.value">
      <button class="btn sm danger" onclick="App._editDay.info.matches.splice(${i},1);App.renderScheduleModal()">删除</button>
    </div>`).join('') || '<div class="empty">当日无比赛</div>';
  App.modal(`赛程修正 · ${D.dateCN(date)}（周${D.weekdayCN(date)}）`, `
    <div class="form-row">
      <div><label>日类型</label>
        <select id="day-type">
          <option value="rest" ${info.type==='rest'?'selected':''}>休赛日</option>
          <option value="match" ${info.type==='match'?'selected':''}>比赛日</option>
        </select>
      </div>
      <div><label>来源</label>
        <div style="padding:8px 2px">${info.manual ? '<span class="badge manual">手动修正（同步不覆盖）</span>' : '<span class="hint">自动（官方同步）</span>'}</div>
      </div>
    </div>
    <label style="font-size:12px;color:var(--sub)">比赛场次</label>
    ${matchesHTML}
    <button class="btn sm" onclick="App._editDay.info.matches.push({time:'17:00',name:'',stage:'',bo:'BO3',teams:''});App.renderScheduleModal()">+ 添加场次</button>
  `, `
    ${info.manual ? `<button class="btn" onclick="App.scheduleDayReset('${date}')">恢复为官方赛程</button>` : ''}
    <button class="btn" onclick="App.closeModal()">取消</button>
    <button class="btn primary" onclick="App.scheduleDaySave('${date}')">保存修正</button>
  `);
};

App.scheduleDaySave = function(date){
  const st = App.state;
  const info = App._editDay.info;
  info.type = document.getElementById('day-type').value;
  info.manual = true;                      // 手动修正优先
  info.matches.forEach(mt => { if(!mt.name) mt.name = LEAGUE + ' ' + (mt.stage || '比赛'); });
  const old = st.scheduleDays[date];
  App.pushHistory('schedule');
  st.scheduleDays[date] = info;
  // 当日类型变化且已有排班 → 提示冲突
  if(old && old.type !== info.type && st.shifts[date] && Object.keys(st.shifts[date]).length){
    App.toast(`已修正 ${D.dateCN(date)} 日类型，当日已有排班，请前往「排班管理」重新排班/检测冲突`, 'warn', 6000);
  } else {
    App.toast('赛程修正已保存', 'ok');
  }
  App.save();
  App.closeModal();
  App.renderView();
};

App.scheduleDayReset = function(date){
  const remote = calendarAtRev(App.state.remoteRev);
  if(remote[date]){
    App.pushHistory('schedule');
    App.state.scheduleDays[date] = JSON.parse(JSON.stringify(remote[date]));
    App.save();
    App.toast('已恢复为官方赛程', 'ok');
  } else {
    App.toast('官方赛程中暂无该日数据', 'warn');
  }
  App.closeModal();
  App.renderView();
};

/* ---------- 撤销 / 重做 / 重置 / 清空 ---------- */
App.undoSchedule = function(){
  if(App.undoSection('schedule')){
    App.toast('已撤销', 'info', 1500);
    App.renderView();
  }
};
App.redoSchedule = function(){
  if(App.redoSection('schedule')){
    App.toast('已重做', 'info', 1500);
    App.renderView();
  }
};
App.resetSchedule = function(){
  if(!confirm('确定重置到进入赛程日历页时的状态？当前所有未同步的赛程修改将被撤销。')) return;
  if(App.resetSection('schedule')){
    App.toast('已重置到初始状态', 'ok', 2000);
    App.renderView();
  }
};

App.clearSchedule = function(){
  const monthStr = App.ui.scheduleMonth || D.today().slice(0, 7);
  const { y, m } = D.ym(monthStr + '-01');
  const days = D.monthDays(y, m);
  const label = y + '年' + m + '月';
  const hasData = days.some(ds => App.state.scheduleDays[ds]);
  if(!hasData){ App.toast('当前' + label + '没有赛程数据', 'info'); return; }
  if(!confirm('确定清空' + label + '全部赛程数据？\n\n此操作将删除当月所有比赛日/休赛日定义及场次信息。\n排班数据不受影响，但已排班的比赛日将失去赛程依据。\n\n此操作可通过 ↶ 撤销恢复。')) return;
  App.pushHistory('schedule');
  days.forEach(ds => { delete App.state.scheduleDays[ds]; });
  App.save();
  App.toast(label + '赛程数据已清空', 'ok');
  App.renderView();
};
