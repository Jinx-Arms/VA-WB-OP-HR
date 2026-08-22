/* =====================================================
 * view-assets.js — 管理员素材后台（admin:true）
 * 队伍素材（队徽 / 选手 / 教练）、解说素材、字体素材。
 * 所有写操作带 App.can('manage') 守卫；普通运营不可见录入入口。
 * ===================================================== */

App.renderAssets = function(){
  if(!App.can('manage')) return '<div class="empty">无权限：素材后台仅管理员可访问</div>';
  const teams = Object.values(App.state.teams || {});
  const selTeam = App._assetsTeam || (teams[0] && teams[0].id);
  if(selTeam) App._assetsTeam = selTeam;
  const t = App.state.teams[selTeam];

  const teamOpts = teams.map(x => `<option value="${x.id}" ${x.id===selTeam?'selected':''}>${x.name}（${x.shortName}）</option>`).join('');

  return `
  <div class="rf-head">
    <h2>素材管理 <small>管理员专属 · 队徽 / 选手 / 教练 / 解说 / 字体</small></h2>
  </div>

  <div class="al-layout">
    <!-- 左：队伍选择 -->
    <div class="card al-side">
      <h3>① 队伍素材</h3>
      <div class="form-row single"><label>选择队伍</label>
        <select onchange="App.assetsSelectTeam(this.value)">${teamOpts}</select>
      </div>
      ${t ? `
      <div class="al-logo">
        <div class="al-logo-prev">${t.logo ? `<img src="${t.logo}" alt="logo">` : '<span class="muted">未上传队徽</span>'}</div>
        <button class="btn" onclick="App.assetsUploadAvatar('logo','${t.id}',-1,'logos')">⬆ 上传队徽</button>
      </div>
      <h4>选手名单（首发图用）</h4>
      <div class="al-players">
        ${(t.roster||[]).map((p,i)=>`
          <div class="al-player">
            <div class="al-ava">${p.avatar?`<img src="${p.avatar}">`:'<span>无</span>'}</div>
            <div class="al-pf">
              <input value="${escAttr(p.id)}" placeholder="游戏ID" onchange="App.assetsSetField('player','${t.id}',${i},'id',this.value)">
              <input value="${escAttr(p.name||'')}" placeholder="中文昵称(可选)" onchange="App.assetsSetField('player','${t.id}',${i},'name',this.value)">
              <input value="${escAttr(p.number||'')}" placeholder="背号" onchange="App.assetsSetField('player','${t.id}',${i},'number',this.value)">
            </div>
            <div class="al-pact">
              <button class="btn sm" onclick="App.assetsUploadAvatar('player','${t.id}',${i},'portraits')">头像</button>
              <button class="btn sm danger" onclick="App.assetsRemovePlayer('${t.id}',${i})">删</button>
            </div>
          </div>`).join('')}
        <button class="btn" onclick="App.assetsAddPlayer('${t.id}')">＋ 新增选手</button>
      </div>
      <h4>教练（首发图用）</h4>
      <div class="al-players">
        ${(t.coaches||[]).map((c,i)=>`
          <div class="al-player">
            <div class="al-ava">${c.avatar?`<img src="${c.avatar}">`:'<span>无</span>'}</div>
            <div class="al-pf">
              <input value="${escAttr(c.name||'')}" placeholder="教练姓名" onchange="App.assetsSetField('coach','${t.id}',${i},'name',this.value)">
              <input value="${escAttr(c.role||'')}" placeholder="角色(主教练/助理教练)" onchange="App.assetsSetField('coach','${t.id}',${i},'role',this.value)">
            </div>
            <div class="al-pact">
              <button class="btn sm" onclick="App.assetsUploadAvatar('coach','${t.id}',${i},'coaches')">头像</button>
              <button class="btn sm danger" onclick="App.assetsRemoveCoach('${t.id}',${i})">删</button>
            </div>
          </div>`).join('')}
        <button class="btn" onclick="App.assetsAddCoach('${t.id}')">＋ 新增教练</button>
      </div>
      ` : '<div class="empty">无队伍数据</div>'}
    </div>

    <!-- 右：解说 + 字体 -->
    <div class="al-main">
      <div class="card">
        <h3>② 解说素材（解说图用）</h3>
        <div class="al-casters">
          ${(App.state.casters||[]).map((c,i)=>`
            <div class="al-player">
              <div class="al-ava">${c.portrait?`<img src="${c.portrait}">`:'<span>无</span>'}</div>
              <div class="al-pf">
                <input value="${escAttr(c.name||'')}" placeholder="解说姓名" onchange="App.assetsSetField('caster',null,${i},'name',this.value)">
                <input value="${escAttr(c.role||'')}" placeholder="角色(主解说/见习解说/嘉宾)" onchange="App.assetsSetField('caster',null,${i},'role',this.value)">
              </div>
              <div class="al-pact">
                <button class="btn sm" onclick="App.assetsUploadAvatar('caster',null,${i},'casters')">定妆照</button>
                <button class="btn sm danger" onclick="App.assetsRemoveCaster(${i})">删</button>
              </div>
            </div>`).join('')}
          <button class="btn" onclick="App.assetsAddCaster()">＋ 新增解说</button>
        </div>
      </div>

      <div class="card">
        <h3>③ 字体素材</h3>
        <div class="toolbar">
          <button class="btn" onclick="App.assetsUploadFont('local')">⬆ 本地上传（仅本次会话）</button>
          <button class="btn primary" onclick="App.assetsUploadFont('storage')">⬆ 上传并加入白名单</button>
        </div>
        <div class="hint">白名单当前：${ (App.state.allowedFonts||[]).length ? (App.state.allowedFonts.join('、')) : '（空 = 不限制）' }</div>
        <table class="al-font-tbl">
          <tr><th>字体族</th><th>来源</th><th>操作</th></tr>
          ${(App.state.fonts||[]).map((f,i)=>`
            <tr><td>${escHtml(f.family)}</td><td>${f.scope==='local'?'本地':'Storage'}</td>
              <td><button class="btn sm danger" onclick="App.assetsRemoveFont(${i})">移除白名单</button></td></tr>`).join('')}
        </table>
      </div>
    </div>
  </div>`;
};

/* ---------- 素材后台写操作（均带 admin 守卫） ---------- */
App.assetsSelectTeam = function(id){ App._assetsTeam = id; App.renderView(); };

App.assetsSetField = function(kind, teamId, idx, field, val){
  if(!App.can('manage')){ App.toast('仅管理员可录入素材','err'); return; }
  if(kind === 'player'){ const t = App.state.teams[teamId]; if(t && t.roster[idx]) t.roster[idx][field] = val; }
  else if(kind === 'coach'){ const t = App.state.teams[teamId]; if(t && t.coaches[idx]) t.coaches[idx][field] = val; }
  else if(kind === 'caster'){ if(App.state.casters[idx]) App.state.casters[idx][field] = val; }
  App.save();
};

App.assetsUploadAvatar = function(kind, teamId, idx, folder){
  if(!App.can('manage')){ App.toast('仅管理员可录入素材','err'); return; }
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/webp';
  inp.onchange = async () => {
    const f = inp.files[0]; if(!f) return;
    if(f.size > 5*1024*1024){ App.toast('文件超过 5MB','err'); return; }
    App.toast('上传中…','info');
    try{
      const url = await ASSETS.upload(f, folder);
      if(kind === 'player'){ const t = App.state.teams[teamId]; if(t && t.roster[idx]) t.roster[idx].avatar = url; }
      else if(kind === 'coach'){ const t = App.state.teams[teamId]; if(t && t.coaches[idx]) t.coaches[idx].avatar = url; }
      else if(kind === 'logo'){ if(App.state.teams[teamId]) App.state.teams[teamId].logo = url; }
      else if(kind === 'caster'){ if(App.state.casters[idx]) App.state.casters[idx].portrait = url; }
      App.save(); App.renderView();
    }catch(e){ App.toast('上传失败：' + e.message,'err'); }
  };
  inp.click();
};

App.assetsAddPlayer = function(teamId){
  if(!App.can('manage')){ App.toast('仅管理员可录入素材','err'); return; }
  const t = App.state.teams[teamId]; if(!t) return;
  t.roster.push({ id:'', name:'', avatar:'', number:'', formerTeams:[] });
  App.save(); App.renderView();
};
App.assetsRemovePlayer = function(teamId, idx){
  if(!App.can('manage')) return;
  const t = App.state.teams[teamId]; if(!t) return;
  t.roster.splice(idx, 1); App.save(); App.renderView();
};
App.assetsAddCoach = function(teamId){
  if(!App.can('manage')){ App.toast('仅管理员可录入素材','err'); return; }
  const t = App.state.teams[teamId]; if(!t) return;
  t.coaches.push({ id:'c'+Date.now().toString(36), name:'', role:'主教练', avatar:'' });
  App.save(); App.renderView();
};
App.assetsRemoveCoach = function(teamId, idx){
  if(!App.can('manage')) return;
  const t = App.state.teams[teamId]; if(!t) return;
  t.coaches.splice(idx, 1); App.save(); App.renderView();
};

App.assetsAddCaster = function(){
  if(!App.can('manage')){ App.toast('仅管理员可录入素材','err'); return; }
  App.state.casters.push({ id: App.uid('C'), name:'', portrait:'', role:'主解说', createdBy: App.state.user, createdAt: Date.now() });
  App.save(); App.renderView();
};
App.assetsRemoveCaster = function(idx){
  if(!App.can('manage')) return;
  App.state.casters.splice(idx, 1); App.save(); App.renderView();
};

App.assetsUploadFont = function(scope){
  if(!App.can('manage')){ App.toast('仅管理员可管理字体','err'); return; }
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.ttf,.otf,.woff,.woff2';
  inp.onchange = async () => {
    const f = inp.files[0]; if(!f) return;
    const family = f.name.replace(/\.[^.]+$/, '').replace(/[^\w\u4e00-\u9fa5-]/g, '_');
    try{
      if(scope === 'local'){
        await FONT.loadLocalFont(f);
        App.toast('本地字体已加载（仅本次会话）：' + family, 'ok');
      } else {
        const url = await ASSETS.upload(f, 'fonts');
        App.state.fonts.push({ family, name:f.name, url, scope:'public', uploadedBy: App.state.user, uploadedAt: Date.now() });
        await FONT.registerFont(family, url);
        if(!(App.state.allowedFonts || []).includes(family)) App.state.allowedFonts.push(family);
        App.save(); App.renderView();
        App.toast('字体已上传并加入白名单', 'ok');
      }
    }catch(e){ App.toast('字体处理失败：' + e.message, 'err'); }
  };
  inp.click();
};

App.assetsRemoveFont = function(idx){
  if(!App.can('manage')) return;
  const f = App.state.fonts[idx];
  if(f) App.state.allowedFonts = App.state.allowedFonts.filter(x => x !== f.family);
  App.state.fonts.splice(idx, 1);
  App.save(); App.renderView();
};

/* 转义辅助 */
function escHtml(s){ return String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function escAttr(s){ return escHtml(s).replace(/'/g, '&#39;'); }
