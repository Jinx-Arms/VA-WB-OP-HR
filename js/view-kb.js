/* =====================================================
 * view-kb.js — VCT 知识库页面（框架）
 * 内容外置至 data/kb-content.json（由 scripts/build-kb-content.js 生成）
 * 本文件只负责：侧边栏、章节骨架、滚动交互、内容加载
 * ===================================================== */

App._kbContent = null;

App._kbLoadContent = async function(){
  if(App._kbContent) return;
  try{
    const res = await fetch('data/kb-content.json');
    App._kbContent = await res.json();
  }catch(e){
    App._kbContent = {};
  }
};

App.renderKB = function(){
  const c = App._kbContent;
  if(!c){
    /* 首次进入：异步加载后重新渲染 */
    App._kbLoadContent().then(() => { if(App.currentView === 'kb') App.renderView(); });
    return `<div class="kb-loading" style="padding:60px;text-align:center;color:var(--sub)">📚 知识库加载中…</div>`;
  }
  return `
  <div class="kb-layout">
    ${App._kbSidebar()}
    <div class="kb-main" id="kb-scroll">
      ${c._kbOverview || ''}
      ${c._kbSystem || ''}
      ${c._kbTimeline || ''}
      ${c._kbChampions || ''}
      ${c._kbRegions || ''}
      ${c._kbPlayers || ''}
      ${c._kbFormat || ''}
      ${c._kbSeason2026 || ''}
      ${c._kbFuture2027 || ''}
      ${c._kbPartners || ''}
      ${c._kbBroadcast || ''}
      ${c._kbMilestones || ''}
      ${c._kbFooter || ''}
    </div>
  </div>`;
};

/* ---------- 侧边导航 ---------- */
App._kbSidebar = function(){
  const items = [
    ['overview','01','总览'],['system','02','赛事体系'],['timeline','03','时间线'],
    ['champions','04','冠军记录'],['regions','05','赛区与战队'],['players','06','代表选手'],
    ['format','07','赛制与积分'],['season2026','08','2026 赛季'],['future2027','09','2027 改制'],
    ['partners','10','合作伙伴'],['broadcast','11','转播平台'],['milestones','12','里程碑']
  ];
  return `
  <aside class="kb-nav">
    <div class="kb-nav-head">
      <span class="kb-nav-badge">VCT KB</span>
      <span class="kb-nav-title">结构化知识库</span>
    </div>
    ${items.map(([id,num,label]) => `
      <a class="kb-nav-item" href="#kb-${id}" onclick="App._kbScrollTo('${id}')">
        <span class="kb-nav-num">${num}</span>${label}
      </a>`).join('')}
    <div class="kb-nav-foot">资料截至 2026 年 8 月</div>
  </aside>`;
};

App._kbScrollTo = function(id){
  const el = document.getElementById('kb-' + id);
  if(el) el.scrollIntoView({ behavior:'smooth', block:'start' });
  /* 更新激活态 */
  document.querySelectorAll('.kb-nav-item').forEach(a => a.classList.remove('active'));
  const navItem = document.querySelector(`.kb-nav-item[onclick="App._kbScrollTo('${id}')"]`);
  if(navItem) navItem.classList.add('active');
};
