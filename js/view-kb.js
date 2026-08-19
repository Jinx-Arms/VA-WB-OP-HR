/* =====================================================
 * view-kb.js — VCT 知识库页面
 * 将结构化知识库内容整合到后台系统，适配深色/浅色主题
 * ===================================================== */

App.renderKB = function(){
  return `
  <div class="kb-layout">
    ${App._kbSidebar()}
    <div class="kb-main" id="kb-scroll">
      ${App._kbOverview()}
      ${App._kbSystem()}
      ${App._kbTimeline()}
      ${App._kbChampions()}
      ${App._kbRegions()}
      ${App._kbPlayers()}
      ${App._kbFormat()}
      ${App._kbSeason2026()}
      ${App._kbFuture2027()}
      ${App._kbPartners()}
      ${App._kbBroadcast()}
      ${App._kbMilestones()}
      ${App._kbFooter()}
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

/* ---------- 章节通用 ---------- */
App._kbSection = function(id, num, title, desc, inner){
  return `
  <section class="kb-section" id="kb-${id}">
    <div class="kb-sec-head">
      <span class="kb-sec-num">${num}</span>
      <h2>${title}</h2>
    </div>
    <p class="kb-sec-desc">${desc}</p>
    ${inner}
  </section>`;
};

App._kbCard = function(inner){
  return `<div class="kb-card">${inner}</div>`;
};

App._kbTag = function(cls, text){
  return `<span class="kb-tag ${cls}">${text}</span>`;
};

App._kbNote = function(inner){
  return `<div class="kb-note">${inner}</div>`;
};

App._kbInfo = function(inner){
  return `<div class="kb-info">${inner}</div>`;
};

/* ---------- 01 总览 ---------- */
App._kbOverview = function(){
  return App._kbSection('overview','01','总览：VCT 是什么','定义、定位与规模概况', `
    ${App._kbCard(`
      <p><strong>无畏契约冠军巡回赛</strong>（VALORANT Champions Tour，简称 <strong>VCT</strong>）是 Riot Games 为其战术射击游戏《无畏契约》（VALORANT）打造的<strong>官方一级（Tier 1）全球电竞赛事体系</strong>。它并非单一赛事，而是由地区联赛、国际大师赛、全球冠军赛及次级晋级通道共同构成的年度赛事总称。</p>
      <p>VCT 起源于 2020 年的先锋赛（First Strike）试点，2021 年正式成为体系化赛事。<strong>2021 雷克雅未克大师赛</strong>是 VCT 历史上第一个国际赛事（冠军 Sentinels）；<strong>2021 柏林全球冠军赛</strong>则诞生了首位世界冠军 Acend。</p>
      <p style="margin-bottom:0">2023 赛季起，VCT 从"开放挑战赛"模式转向<strong>特许合作战队（Partnership）+ 国际联赛</strong>模式；2027 赛季将再次转型为<strong>以锦标赛为核心的开放体系</strong>，是项目史上最大幅度的结构改革。</p>
    `)}
    <div class="kb-grid kb-g4">
      <div class="kb-stat"><div class="kb-stat-v">4</div><div class="kb-stat-l">国际联赛赛区<br>Americas / EMEA / Pacific / CN</div></div>
      <div class="kb-stat"><div class="kb-stat-v">48</div><div class="kb-stat-l">一级联赛参赛队伍<br>每赛区 12 支（2025 起）</div></div>
      <div class="kb-stat"><div class="kb-stat-v">16</div><div class="kb-stat-l">全球冠军赛参赛席位<br>Champions 决赛圈</div></div>
      <div class="kb-stat"><div class="kb-stat-v">3</div><div class="kb-stat-l">年度国际赛事<br>2 站大师赛 + 1 站冠军赛</div></div>
    </div>
  `);
};

/* ---------- 02 赛事体系 ---------- */
App._kbSystem = function(){
  return App._kbSection('system','02','赛事体系与层级结构','从公开选拔到世界冠军的完整层级（以 2023–2026 特许联赛时代为准）', `
    <h3 class="kb-h3">层级一览</h3>

    <div class="kb-tier kb-t1">
      <div class="kb-tier-top">
        <span class="kb-tier-badge">TIER 1 · 全球</span>
        <span class="kb-tier-name">全球冠军赛</span>
        <span class="kb-tier-en">CHAMPIONS</span>
      </div>
      <p style="margin-bottom:0">赛季最高荣誉，类比《英雄联盟》全球总决赛。<strong>16 支</strong>全球顶尖队伍角逐"无畏契约世界冠军"称号。每年一届，举办地全球轮转。2026 年奖金池 <strong>225 万美元</strong>。</p>
    </div>

    <div class="kb-tier kb-t1">
      <div class="kb-tier-top">
        <span class="kb-tier-badge">TIER 1 · 全球</span>
        <span class="kb-tier-name">大师赛</span>
        <span class="kb-tier-en">MASTERS</span>
      </div>
      <p style="margin-bottom:0">每年 <strong>2 站</strong>国际锦标赛。2026 年起两站均为 <strong>12 支</strong>队伍参赛，单站奖金池 <strong>100 万美元</strong>。含金量定位介于 MSI 与 S 赛之间。</p>
    </div>

    <div class="kb-tier kb-t1">
      <div class="kb-tier-top">
        <span class="kb-tier-badge">TIER 1 · 赛区</span>
        <span class="kb-tier-name">国际联赛</span>
        <span class="kb-tier-en">INTERNATIONAL LEAGUES</span>
      </div>
      <p>四大赛区的常规赛体系。每赛区 12 支队伍（10 支特许合作战队 + 2 支晋升战队），赛季内分为<strong>启点赛、第一赛段、第二赛段</strong>三个阶段。</p>
      <div>
        ${App._kbTag('a','VCT 美洲联赛 Americas')}
        ${App._kbTag('b','VCT EMEA 联赛')}
        ${App._kbTag('t','VCT 太平洋联赛 Pacific')}
        ${App._kbTag('m','VCT CN 联赛')}
      </div>
    </div>

    <div class="kb-tier kb-t2">
      <div class="kb-tier-top">
        <span class="kb-tier-badge">TIER 2</span>
        <span class="kb-tier-name">挑战者联赛 / CN 全国大赛</span>
        <span class="kb-tier-en">CHALLENGERS / CN NATIONALS</span>
      </div>
      <p style="margin-bottom:0">各小赛区的次级联赛。CN 赛区对应赛事为<strong>全国大赛</strong>（四大赛道，海选至线下总决赛），积分前八的职业认证战队可争夺晋级机会。</p>
    </div>

    <div class="kb-tier kb-t2">
      <div class="kb-tier-top">
        <span class="kb-tier-badge">TIER 2</span>
        <span class="kb-tier-name">晋升赛</span>
        <span class="kb-tier-en">ASCENSION</span>
      </div>
      <p style="margin-bottom:0">挑战者联赛顶尖队伍争夺国际联赛席位的通道。<strong>2026 赛季除 CN 赛区外暂停举办</strong>，将于 2027 赛季被"公开入围赛"体系取代。</p>
    </div>

    <div class="kb-tier kb-t3">
      <div class="kb-tier-top">
        <span class="kb-tier-badge">平行体系</span>
        <span class="kb-tier-name">改变者赛</span>
        <span class="kb-tier-en">GAME CHANGERS</span>
      </div>
      <p style="margin-bottom:0">专为非男性选手打造的赛事体系，设有各赛区联赛与年终<strong>改变者全球冠军赛</strong>。</p>
    </div>

    <h3 class="kb-h3">晋级链路（2026 赛季）</h3>
    ${App._kbCard(`
      <div class="kb-flow">
        <span class="kb-flow-node kb-flow-rg">启点赛 Kickoff</span><span class="kb-flow-arrow">→</span>
        <span class="kb-flow-node kb-flow-gl">圣地亚哥大师赛</span><span class="kb-flow-arrow">→</span>
        <span class="kb-flow-node kb-flow-rg">第一赛段 Stage 1</span><span class="kb-flow-arrow">→</span>
        <span class="kb-flow-node kb-flow-gl">伦敦大师赛</span><span class="kb-flow-arrow">→</span>
        <span class="kb-flow-node kb-flow-rg">第二赛段 Stage 2</span><span class="kb-flow-arrow">→</span>
        <span class="kb-flow-node kb-flow-gl">上海全球冠军赛</span>
      </div>
      <p style="margin-bottom:0; color:var(--dim)">蓝色为赛区赛事，红色为全球赛事。冠军赛积分贯穿全部环节累积。</p>
    `)}

    <h3 class="kb-h3">赛区与下辖小赛区</h3>
    <div class="kb-grid kb-g2">
      ${App._kbCard(`
        <h4 class="kb-h4">美洲赛区 Americas</h4>
        <ul class="kb-list"><li><b>北美</b> — 美国、加拿大</li><li><b>拉美北区</b> — 墨西哥、中美洲、哥伦比亚等</li><li><b>拉美南区</b> — 阿根廷、智利、秘鲁等</li><li><b>巴西</b></li></ul>
      `)}
      ${App._kbCard(`
        <h4 class="kb-h4">EMEA 赛区</h4>
        <ul class="kb-list"><li><b>North//East</b> — 北欧、中东欧、巴尔干</li><li><b>西班牙</b> — 含原意大利、葡萄牙赛区</li><li><b>法国与低地国家</b></li><li><b>DACH</b> — 德国、奥地利、瑞士</li><li><b>土耳其</b></li><li><b>中东与北非 MENA</b></li></ul>
      `)}
      ${App._kbCard(`
        <h4 class="kb-h4">太平洋赛区 Pacific</h4>
        <ul class="kb-list"><li><b>日本 / 韩国</b></li><li><b>东南亚 SEA</b> — 泰国、印尼、菲律宾、越南等</li><li><b>南亚</b> — 印度、孟加拉国等</li><li><b>大洋洲</b> — 2026 年撤销</li></ul>
      `)}
      ${App._kbCard(`
        <h4 class="kb-h4">中国赛区 CN</h4>
        <ul class="kb-list"><li>大小赛区一体，不设下辖小赛区</li><li>次级通道为<b>全国大赛</b></li><li>2025 赛季起增设<b>进化者杯</b></li><li>2026 赛季首创<b>七城巡回</b></li></ul>
      `)}
    </div>

    ${App._kbNote('<b>补充说明：</b> 太平洋赛区中来自中国港澳台的选手，在太平洋赛区与 CN 赛区<strong>均具备本土选手身份</strong>。')}
  `);
};

/* ---------- 03 时间线 ---------- */
App._kbTimeline = function(){
  const years = [
    { y:'2021', sub:'VCT 元年', hi:true,
      note:'结构：挑战者赛 × 3 阶段 → 大师赛 × 3 → 最终入围赛 → 全球冠军赛。采用循环积分决定冠军赛资格。',
      events:[
        ['第一阶段大师赛','各赛区分区举办',''],
        ['雷克雅未克大师赛','冰岛 · 雷克雅未克','Sentinels 3:0 Fnatic'],
        ['柏林大师赛','德国 · 柏林','Gambit Esports 3:0 Team Envy'],
        ['柏林全球冠军赛','德国 · 柏林','Acend 3:2 Gambit Esports']
      ] },
    { y:'2022', sub:'', hi:false,
      note:'结构精简为：挑战者赛 × 2 → 大师赛 × 2 → 最终入围赛 → 全球冠军赛。',
      events:[
        ['雷克雅未克大师赛','冰岛 · 雷克雅未克','OpTic Gaming 3:0 LOUD'],
        ['哥本哈根大师赛','丹麦 · 哥本哈根','FunPlus Phoenix 3:2 Paper Rex'],
        ['伊斯坦布尔全球冠军赛','土耳其 · 伊斯坦布尔','LOUD 3:1 OpTic Gaming']
      ] },
    { y:'2023', sub:'特许联赛元年', hi:true,
      note:'首次启用国际联赛 + 合作战队制，三大赛区各 10 支特许战队。',
      events:[
        ['圣保罗季前邀请赛 LOCK//IN','巴西 · 圣保罗','Fnatic 3:2 LOUD'],
        ['东京大师赛','日本 · 东京','Fnatic 3:0 Evil Geniuses'],
        ['洛杉矶全球冠军赛','美国 · 洛杉矶','Evil Geniuses 3:1 Paper Rex']
      ] },
    { y:'2024', sub:'CN 联赛加入', hi:true,
      note:'VCT CN 联赛正式成立，合作战队扩充至 40 支。最终入围赛取消。',
      events:[
        ['马德里大师赛','西班牙 · 马德里','Sentinels 3:2 Gen.G Esports'],
        ['上海大师赛','中国 · 上海','Gen.G Esports 3:2 Team Heretics'],
        ['首尔全球冠军赛','韩国 · 首尔','EDward Gaming 3:2 Team Heretics']
      ] },
    { y:'2025', sub:'扩军至 48 队', hi:true,
      note:'每赛区扩至 12 支队伍。积分改革为所有赛事均可获得冠军赛积分。',
      events:[
        ['曼谷大师赛','泰国 · 曼谷','T1 3:2 G2 Esports'],
        ['多伦多大师赛','加拿大 · 多伦多','Paper Rex 3:1 Fnatic'],
        ['巴黎全球冠军赛','法国 · 巴黎','NRG 3:2 Fnatic']
      ] },
    { y:'2026', sub:'进行中', now:true,
      note:'全球赛事横跨三大洲。启点赛首创三败淘汰制；四大赛区第二赛段季后赛全面线下化。',
      events:[
        ['启点赛 Kickoff','各赛区 · 1/15–2/15','三败淘汰制，每赛区前 3 名晋级'],
        ['圣地亚哥大师赛','智利 · 圣地亚哥','Nongshim RedForce 3:0 Paper Rex'],
        ['第一赛段 Stage 1','各赛区 · 4/1–5/24','每赛区前 3 名晋级伦敦大师赛'],
        ['伦敦大师赛','英国 · 伦敦','LEVIATÁN 3:2 Paper Rex'],
        ['第二赛段 Stage 2','各赛区 · 6/30–9/6','前 2 名 + 积分前 2 名晋级冠军赛'],
        ['上海全球冠军赛','中国 · 上海 · 9/24–10/18','即将举行']
      ] },
    { y:'2027', sub:'已公布规划', hi:false, now:false,
      note:'体系全面改革为以锦标赛为核心的开放生态：取消常规赛联赛，改为公开入围赛 + 赛区杯赛。全年 20+ 场锦标赛，覆盖 16 座以上城市。',
      events:[] }
  ];

  return App._kbSection('timeline','03','历届赛季时间线与办赛地区','2021–2027 赛季结构演变、国际赛事举办城市与结果', `
    <div class="kb-tl">
      ${years.map(yr => `
        <div class="kb-tl-item ${yr.hi?'hi':''} ${yr.now?'now':''}">
          <div class="kb-tl-year">${yr.y} <span class="kb-tl-sub">${yr.sub}</span></div>
          <div class="kb-tl-note">${yr.note}</div>
          ${yr.events.length ? `
          <div class="kb-tl-events">
            ${yr.events.map(([name,city,res]) => `
              <div class="kb-tl-ev"><b>${name}</b><span class="kb-tl-city">${city}</span>${res?`<span class="kb-tl-res">${res}</span>`:''}</div>
            `).join('')}
          </div>` : ''}
        </div>
      `).join('')}
    </div>
  `);
};

/* ---------- 04 冠军记录 ---------- */
App._kbChampions = function(){
  return App._kbSection('champions','04','冠军记录','全球冠军赛、大师赛与赛区联赛的完整夺冠名录', `
    <h3 class="kb-h3">全球冠军赛 Champions</h3>
    <div class="kb-tbl-wrap">
      <table class="kb-tbl">
        <thead><tr><th>年度</th><th>举办城市</th><th>冠军</th><th>比分</th><th>亚军</th><th>备注</th></tr></thead>
        <tbody>
          <tr><td class="kb-y">2021</td><td>德国 · 柏林</td><td class="kb-win kb-gold">Acend</td><td class="kb-score">3:2</td><td>Gambit Esports</td><td>首届世界冠军</td></tr>
          <tr><td class="kb-y">2022</td><td>土耳其 · 伊斯坦布尔</td><td class="kb-win kb-gold">LOUD</td><td class="kb-score">3:1</td><td>OpTic Gaming</td><td>巴西赛区首冠</td></tr>
          <tr><td class="kb-y">2023</td><td>美国 · 洛杉矶</td><td class="kb-win kb-gold">Evil Geniuses</td><td class="kb-score">3:1</td><td>Paper Rex</td><td>北美老牌组织登顶</td></tr>
          <tr><td class="kb-y">2024</td><td>韩国 · 首尔</td><td class="kb-win kb-gold">EDward Gaming</td><td class="kb-score">3:2</td><td>Team Heretics</td><td>CN 赛区首冠</td></tr>
          <tr><td class="kb-y">2025</td><td>法国 · 巴黎</td><td class="kb-win kb-gold">NRG</td><td class="kb-score">3:2</td><td>Fnatic</td><td>全胜夺冠，MVP brawk</td></tr>
          <tr><td class="kb-y">2026</td><td>中国 · 上海</td><td colspan="4" class="kb-dim">2026 年 9 月 24 日 – 10 月 18 日举行，尚未产生结果</td></tr>
        </tbody>
      </table>
    </div>
    ${App._kbInfo('<b>关键规律：</b> 全球冠军赛已举办五届，产生了<strong>五个不同的冠军</strong>——迄今<strong>没有任何战队成功卫冕</strong>。')}

    <h3 class="kb-h3">大师赛 Masters</h3>
    <div class="kb-tbl-wrap">
      <table class="kb-tbl">
        <thead><tr><th>年度</th><th>赛事</th><th>冠军</th><th>比分</th><th>亚军</th></tr></thead>
        <tbody>
          <tr><td class="kb-y">2021</td><td>雷克雅未克大师赛</td><td class="kb-win">Sentinels</td><td class="kb-score">3:0</td><td>Fnatic</td></tr>
          <tr><td class="kb-y">2021</td><td>柏林大师赛</td><td class="kb-win">Gambit Esports</td><td class="kb-score">3:0</td><td>Team Envy</td></tr>
          <tr><td class="kb-y">2022</td><td>雷克雅未克大师赛</td><td class="kb-win">OpTic Gaming</td><td class="kb-score">3:0</td><td>LOUD</td></tr>
          <tr><td class="kb-y">2022</td><td>哥本哈根大师赛</td><td class="kb-win">FunPlus Phoenix</td><td class="kb-score">3:2</td><td>Paper Rex</td></tr>
          <tr><td class="kb-y">2023</td><td>圣保罗季前邀请赛 LOCK//IN</td><td class="kb-win">Fnatic</td><td class="kb-score">3:2</td><td>LOUD</td></tr>
          <tr><td class="kb-y">2023</td><td>东京大师赛</td><td class="kb-win">Fnatic</td><td class="kb-score">3:0</td><td>Evil Geniuses</td></tr>
          <tr><td class="kb-y">2024</td><td>马德里大师赛</td><td class="kb-win">Sentinels</td><td class="kb-score">3:2</td><td>Gen.G Esports</td></tr>
          <tr><td class="kb-y">2024</td><td>上海大师赛</td><td class="kb-win">Gen.G Esports</td><td class="kb-score">3:2</td><td>Team Heretics</td></tr>
          <tr><td class="kb-y">2025</td><td>曼谷大师赛</td><td class="kb-win">T1</td><td class="kb-score">3:2</td><td>G2 Esports</td></tr>
          <tr><td class="kb-y">2025</td><td>多伦多大师赛</td><td class="kb-win">Paper Rex</td><td class="kb-score">3:1</td><td>Fnatic</td></tr>
          <tr><td class="kb-y">2026</td><td>圣地亚哥大师赛</td><td class="kb-win">Nongshim RedForce</td><td class="kb-score">3:0</td><td>Paper Rex</td></tr>
          <tr><td class="kb-y">2026</td><td>伦敦大师赛</td><td class="kb-win">LEVIATÁN</td><td class="kb-score">3:2</td><td>Paper Rex</td></tr>
        </tbody>
      </table>
    </div>

    <h3 class="kb-h3">赛区联赛冠军</h3>
    <div class="kb-tbl-wrap">
      <table class="kb-tbl">
        <thead><tr><th>赛季 / 赛段</th><th>美洲</th><th>EMEA</th><th>太平洋</th><th>CN</th></tr></thead>
        <tbody>
          <tr><td class="kb-y">2023 赛季</td><td>LOUD</td><td>Team Liquid</td><td>Paper Rex</td><td class="kb-dim">— 尚未成立</td></tr>
          <tr><td class="kb-y">2024 启点赛</td><td>Sentinels</td><td>Karmine Corp</td><td>Gen.G</td><td>EDward Gaming</td></tr>
          <tr><td class="kb-y">2024 第一赛段</td><td>100 Thieves</td><td>Fnatic</td><td>Paper Rex</td><td>EDward Gaming</td></tr>
          <tr><td class="kb-y">2024 第二赛段</td><td>Leviatán</td><td>Fnatic</td><td>Gen.G</td><td>EDward Gaming</td></tr>
          <tr><td class="kb-y">2025 启点赛</td><td>G2 Esports</td><td>Team Vitality</td><td>DRX</td><td>EDward Gaming</td></tr>
          <tr><td class="kb-y">2025 第一赛段</td><td>G2 Esports</td><td>Fnatic</td><td>Rex Regum Qeon</td><td>XLG Esports</td></tr>
          <tr><td class="kb-y">2025 第二赛段</td><td>G2 Esports</td><td>Team Liquid</td><td>Paper Rex</td><td>Bilibili Gaming</td></tr>
          <tr><td class="kb-y">2026 第一赛段</td><td>G2 Esports</td><td>Team Heretics</td><td>Paper Rex</td><td>EDward Gaming</td></tr>
        </tbody>
      </table>
    </div>

    <h3 class="kb-h3">晋升赛 Ascension 晋级战队</h3>
    <div class="kb-tbl-wrap">
      <table class="kb-tbl">
        <thead><tr><th>赛季</th><th>美洲</th><th>EMEA</th><th>太平洋</th><th>CN</th></tr></thead>
        <tbody>
          <tr><td class="kb-y">2023</td><td>The Guard → G2 继承</td><td>Gentle Mates</td><td>Bleed → BOOM 递补</td><td>DRG</td></tr>
          <tr><td class="kb-y">2024</td><td>2GAME Esports</td><td>Apeks</td><td>Sin Prisa → NS RedForce</td><td>XLG Esports</td></tr>
          <tr><td class="kb-y">2025</td><td>ENVY</td><td>PCIFIC、ULF</td><td>NS RedForce*、SLT Seongnam</td><td>DRG*</td></tr>
        </tbody>
      </table>
    </div>
    <p class="kb-small kb-dim"><sup>*</sup> 表示该队伍通过晋升赛成功捍卫其国际联赛席位，而非新晋升。</p>
  `);
};

/* ---------- 05 赛区与战队 ---------- */
App._kbRegions = function(){
  const regions = [
    { cls:'am', tag:'Americas', title:'VCT 美洲联赛', loc:'洛杉矶 · Riot Games Arena',
      range:'北美、拉丁美洲、巴西', emblem:'已安放、意图启动的爆能器',
      teams:['100 Thieves','Cloud9','Evil Geniuses','FURIA','G2 Esports','KRÜ','Leviatán','LOUD','MIBR','NRG','Sentinels','ENVY(晋升)'],
      reps:'NRG（2025 世界冠军）、LOUD（2022 世界冠军）、Evil Geniuses（2023 世界冠军）、Sentinels（2 座大师赛冠军）、Leviatán（2026 伦敦大师赛冠军）、G2 Esports（美洲赛区四连冠）' },
    { cls:'em', tag:'EMEA', title:'VCT EMEA 联赛', loc:'德国 · 柏林',
      range:'欧洲、中东与北非', emblem:'象征瞄准的内外交叠十字准星',
      teams:['BBL','Fnatic','FUT','Gentle Mates','GiantX','Karmine Corp','NAVI','Team Heretics','Team Liquid','Team Vitality','PCIFIC(晋升)','ULF(晋升)'],
      reps:'Fnatic（2 座国际赛冠军）、Team Heretics（2026 EMEA 第一赛段冠军）、Team Vitality、Team Liquid、Karmine Corp' },
    { cls:'pa', tag:'Pacific', title:'VCT 太平洋联赛', loc:'韩国首尔 · COEX Artium',
      range:'中国以外的亚洲地区（日韩、东南亚、南亚）', emblem:'以海神"狂潮"为原型的烟幕',
      teams:['Paper Rex','Gen.G','T1','KIWOOM DRX','NS RedForce','Global Esports','RRQ','Team Secret','DFM','ZETA','VARREL(晋升)','FULL SENSE'],
      reps:'Paper Rex（2025 多伦多大师赛冠军、太平洋四连冠）、Gen.G（2024 上海大师赛冠军）、T1（2025 曼谷大师赛冠军）、NS RedForce（2026 圣地亚哥大师赛冠军）' },
    { cls:'cn', tag:'CN', title:'VCT CN 联赛', loc:'中国 · 2026 起七城巡回',
      range:'中国大陆', emblem:'象征开火与击杀的六瓣花火',
      teams:['EDward Gaming','Bilibili Gaming','FunPlus Phoenix','XLG Esports','Trace Esports','All Gamers','TYLOO','Nova Esports','JD Gaming','Titan EC','Wolves','DRG'],
      reps:'EDward Gaming（2024 世界冠军）、XLG Esports、Bilibili Gaming、Dragon Ranger Gaming、FunPlus Phoenix（前身阵容曾夺 2022 哥本哈根大师赛）' }
  ];

  return App._kbSection('regions','05','四大赛区与参赛战队','2026 赛季国际联赛 48 支队伍构成', `
    <div class="kb-grid kb-g2">
      ${regions.map(r => `
        <div class="kb-region">
          <div class="kb-region-head kb-rh-${r.cls}">
            ${App._kbTag(r.cls.charAt(0) === 'a' ? 'a' : r.cls === 'em' ? 'b' : r.cls === 'pa' ? 't' : 'm', r.tag)}
            <span class="kb-region-title">${r.title}</span>
            <span class="kb-region-loc">${r.loc}</span>
          </div>
          <div class="kb-region-body">
            <div class="kb-kv"><span class="kv-k">覆盖范围</span><span class="kv-v">${r.range}</span></div>
            <div class="kb-kv"><span class="kv-k">联赛标志</span><span class="kv-v">${r.emblem}</span></div>
            <div class="kb-kv"><span class="kv-k">2026 队伍</span><span class="kv-v">${r.teams.map(t => App._kbTag('',t)).join('')}</span></div>
            <div class="kb-kv"><span class="kv-k">代表战队</span><span class="kv-v">${r.reps}</span></div>
          </div>
        </div>
      `).join('')}
    </div>
    ${App._kbNote('<b>合作战队遴选标准：</b> 具有长期经营意愿 · 财务状况健康 · 战队知名度与赛区粉丝粘性（<strong>不以历史战绩为主要考量</strong>）。')}
  `);
};

/* ---------- 06 代表选手 ---------- */
App._kbPlayers = function(){
  return App._kbSection('players','06','各赛区代表性选手','依据国际赛事成就、个人荣誉与赛区影响力整理', `
    <h3 class="kb-h3">荣誉纪录持有者</h3>
    <div class="kb-tbl-wrap">
      <table class="kb-tbl">
        <thead><tr><th>选手</th><th>国籍 / 地区</th><th>所属（2026）</th><th>核心成就</th></tr></thead>
        <tbody>
          <tr><td class="kb-win">Chronicle</td><td>俄罗斯</td><td>Team Vitality</td><td><strong>VCT 史上最成功选手</strong> — 三夺 VCT 国际赛冠军</td></tr>
          <tr><td class="kb-win">Ethan</td><td>美国</td><td>NRG（IGL）</td><td><strong>首位两夺全球冠军赛</strong>的选手（2023 EG、2025 NRG）</td></tr>
          <tr><td class="kb-win">aspas</td><td>巴西</td><td>MIBR</td><td>2022 世界冠军、<strong>单图 47 杀历史纪录</strong>、2025 社区票选全球 MVP</td></tr>
          <tr><td class="kb-win">TenZ</td><td>加拿大</td><td>—</td><td>2021 首届世界冠军、项目最具标志性选手之一</td></tr>
          <tr><td class="kb-win">brawk</td><td>美国</td><td>NRG</td><td>2025 巴黎全球冠军赛<strong>总决赛 MVP</strong></td></tr>
          <tr><td class="kb-win">Dambi</td><td>韩国</td><td>NS RedForce</td><td>2026 圣地亚哥大师赛 <strong>MVP</strong></td></tr>
          <tr><td class="kb-win">Neon</td><td>阿根廷</td><td>Leviatán</td><td>2026 伦敦大师赛 <strong>MVP</strong></td></tr>
          <tr><td class="kb-win">Demon1</td><td>美国</td><td>NRG</td><td>2023 全球冠军赛 MVP（EG）</td></tr>
          <tr><td class="kb-win">ZmjjKK</td><td>中国</td><td>EDward Gaming</td><td>2024 世界冠军成员，CN 赛区标志性决斗者</td></tr>
        </tbody>
      </table>
    </div>

    <h3 class="kb-h3">分赛区代表选手</h3>
    <div class="kb-grid kb-g2">
      ${App._kbCard(`
        <h4 class="kb-h4">${App._kbTag('a','Americas')} 美洲赛区</h4>
        <ul class="kb-list">
          <li><b>NRG</b> — Ethan(IGL)、mada、brawk、skuba、keiko</li>
          <li><b>MIBR</b> — aspas、xenom、Verno</li>
          <li><b>Leviatán</b> — kiNgg(IGL)、Neon、spikeziN、Sato、blowz</li>
          <li><b>G2 Esports</b> — valyn(IGL)、trent、leaf、jawgemo</li>
          <li><b>LOUD</b> — cauanzin、pANcada、lukxo</li>
          <li><b>Sentinels</b> — johnqt、Kyu(IGL)、cortezia</li>
        </ul>
        <p class="kb-small kb-dim" style="margin-bottom:0">LEV 阵容平均年龄仅 19.6 岁，VCT 史上最年轻的国际赛冠军队伍。</p>
      `)}
      ${App._kbCard(`
        <h4 class="kb-h4">${App._kbTag('b','EMEA')} 欧洲中东非洲赛区</h4>
        <ul class="kb-list">
          <li><b>Team Vitality</b> — Jamppi(IGL)、Derke、Chronicle、PROFEK、Sayonara</li>
          <li><b>Team Heretics</b> — Boo(IGL)、benjyfishy、RieNs、Wo0t、ComeBack</li>
          <li><b>Fnatic</b> — Boaster(IGL)、Alfajer、kaajak、crashies、Veqaj</li>
          <li><b>FUT Esports</b> — MrFaliN(IGL)、qRaxs、xeus、yetujey</li>
          <li><b>Gentle Mates</b> — starxo(IGL)、Minny、bipo、GLYPH</li>
          <li><b>NAVI / KC</b> — Shao、Ruxic / SUYGETSU、avez</li>
        </ul>
      `)}
      ${App._kbCard(`
        <h4 class="kb-h4">${App._kbTag('t','Pacific')} 太平洋赛区</h4>
        <ul class="kb-list">
          <li><b>Paper Rex</b> — f0rsakeN(IGL)、Jinggg、d4v41、invy、something</li>
          <li><b>NS RedForce</b> — Rb(IGL)、Dambi、Francis、Ivy、Xross</li>
          <li><b>T1</b> — stax、Munchkin(IGL)、BuZz、Meteor、iZu</li>
          <li><b>Gen.G</b> — t3xture、Karon、Ash、Efina、Lakia</li>
          <li><b>KIWOOM DRX</b> — MaKo(IGL)、BeYN、free1ng、HYUNMIN</li>
          <li><b>FULL SENSE</b> — killua、primmie、JitBoyS、seph1roth</li>
        </ul>
      `)}
      ${App._kbCard(`
        <h4 class="kb-h4">${App._kbTag('m','CN')} 中国赛区</h4>
        <ul class="kb-list">
          <li><b>EDward Gaming</b> — ZmjjKK、CHICHOO、nobody(IGL)、Smoggy、Haodong</li>
          <li><b>FunPlus Phoenix</b> — Life、autumn、AAAAY、BerLIN、Lysoar</li>
          <li><b>Bilibili Gaming</b> — Knight、B3Ar、Biank、whzy、yosemite</li>
          <li><b>Dragon Ranger Gaming</b> — Nicc、vo0kashu、TvirusLuke、nizhaoTZH</li>
          <li><b>Trace / All Gamers</b> — Kai、LuoK1ng / Bunt、DeLb、monk</li>
        </ul>
        <p class="kb-small kb-dim" style="margin-bottom:0">2026 电竞世界杯中国队：ZmjjKK、CHICHOO、nobody、Knight 等。</p>
      `)}
    </div>
    ${App._kbNote('<b>阵容时效性提示：</b> 职业选手转会频繁，上表为 2026 赛季公开阵容信息。')}
  `);
};

/* ---------- 07 赛制与积分 ---------- */
App._kbFormat = function(){
  return App._kbSection('format','07','赛制规则与积分晋级机制','对局规则、冠军赛积分体系与各环节晋级路径', `
    <h3 class="kb-h3">基础对局规则</h3>
    <div class="kb-grid kb-g3">
      ${App._kbCard(`<h4 class="kb-h4">局数设置</h4><ul class="kb-list"><li>常规赛 / 瑞士轮 — <b>BO3</b></li><li>败者组决赛、总决赛 — <b>BO5</b></li></ul>`)}
      ${App._kbCard(`<h4 class="kb-h4">单图胜负</h4><ul class="kb-list"><li>先赢 <b>13 回合</b>者胜</li><li>12:12 加时，需<b>净胜 2 回合</b></li><li>攻防半场各 12 回合</li></ul>`)}
      ${App._kbCard(`<h4 class="kb-h4">常用赛制</h4><ul class="kb-list"><li><b>双败淘汰</b> — 季后赛主流</li><li><b>瑞士轮</b> — 大师赛第一阶段</li><li><b>三败淘汰</b> — 2026 启点赛首创</li><li><b>单循环</b> — 常规赛小组内</li></ul>`)}
    </div>

    <h3 class="kb-h3">冠军赛积分（2026 赛季）</h3>
    <p>2025 赛季起改革为<strong>所有赛事均可获得积分</strong>，以奖励全年稳定表现。</p>
    <div class="kb-tbl-wrap">
      <table class="kb-tbl kb-pts">
        <thead><tr><th>赛事</th><th>冠军</th><th>亚军</th><th>季军</th><th>殿军</th><th>5–6 名</th><th>常规赛每胜</th></tr></thead>
        <tbody>
          <tr><td>启点赛 Kickoff</td><td class="kb-v">4</td><td class="kb-v">3</td><td class="kb-v">2</td><td class="kb-v">1</td><td class="kb-dim">—</td><td class="kb-dim">—</td></tr>
          <tr><td>圣地亚哥大师赛</td><td class="kb-v">6</td><td class="kb-v">4</td><td class="kb-v">3</td><td class="kb-v">2</td><td class="kb-v">1</td><td class="kb-dim">—</td></tr>
          <tr><td>第一赛段 Stage 1</td><td colspan="5" class="kb-dim">季后赛按名次分配额外积分</td><td class="kb-v">1</td></tr>
          <tr><td>伦敦大师赛</td><td class="kb-v">8</td><td class="kb-v">6</td><td class="kb-v">5</td><td class="kb-v">4</td><td class="kb-v">3</td><td class="kb-dim">—</td></tr>
          <tr><td>第二赛段 Stage 2</td><td colspan="5" class="kb-dim">季后赛按名次分配额外积分</td><td class="kb-v">1</td></tr>
        </tbody>
      </table>
    </div>

    <h3 class="kb-h3">各环节晋级路径（2026）</h3>
    <div class="kb-grid kb-g2">
      ${App._kbCard(`<h4 class="kb-h4">① 启点赛 Kickoff <span class="kb-tag b">1–2 月</span></h4><p>12 队采用<strong>三败淘汰制</strong>。上赛季冠军赛 4 队获首轮轮空。</p><p style="margin-bottom:0"><strong>晋级：</strong>三个组别决赛胜者（共 3 队）晋级圣地亚哥大师赛。</p>`)}
      ${App._kbCard(`<h4 class="kb-h4">② 大师赛 <span class="kb-tag a">全球</span></h4><p>12 队分两阶段：<strong>瑞士轮</strong>（8 支二、三号种子）+ <strong>双败淘汰赛</strong>（4 支一号种子直入 8 强）。</p>`)}
      ${App._kbCard(`<h4 class="kb-h4">③ 第一赛段 <span class="kb-tag b">4–5 月</span></h4><p>12 队分两组单循环 BO3。每组前四晋级季后赛。</p><p style="margin-bottom:0"><strong>晋级：</strong>季后赛前 3 名晋级伦敦大师赛。</p>`)}
      ${App._kbCard(`<h4 class="kb-h4">④ 第二赛段 <span class="kb-tag b">6–9 月</span></h4><p>前两名直接入季后赛；后四名与 4 支挑战者赛队伍进行双败入围赛。</p><p style="margin-bottom:0"><strong>晋级：</strong>季后赛前 2 名 + 积分前 2 名 → 上海冠军赛。</p>`)}
      ${App._kbCard(`<h4 class="kb-h4">⑤ 全球冠军赛 <span class="kb-tag a">9–10 月</span></h4><p><strong>小组赛：</strong>16 队分 4 组双败 BO3。2 胜进 8 强。</p><p style="margin-bottom:0"><strong>淘汰赛：</strong>8 队双败，败决与总决赛为 BO5。</p>`)}
      ${App._kbCard(`<h4 class="kb-h4">⑥ 席位构成 <span class="kb-tag t">16 席</span></h4><ul class="kb-list"><li>四大赛区第二赛段冠亚军 — 8 席</li><li>四大赛区积分榜前 2 — 8 席</li></ul>`)}
    </div>

    <h3 class="kb-h3">队伍留存与升降级</h3>
    ${App._kbCard(`
      <ul class="kb-list">
        <li>非合作战队签<b>一年期</b>合约</li>
        <li>排名 <b>1–4 名</b> — 自动锁定下赛季席位</li>
        <li>排名 <b>5–8 名</b> — 需参加晋升赛保留席位</li>
        <li>排名 <b>9–12 名</b> — 降级回挑战者联赛</li>
        <li>2026 赛季除 CN 外<b>晋升赛暂停</b>，为 2027 改革过渡</li>
      </ul>
    `)}
  `);
};

/* ---------- 08 2026 赛季 ---------- */
App._kbSeason2026 = function(){
  return App._kbSection('season2026','08','2026 赛季详解','当前赛季的关键变化、三大洲赛事与 CN 七城巡回', `
    <h3 class="kb-h3">国际赛事一览</h3>
    <div class="kb-tbl-wrap">
      <table class="kb-tbl">
        <thead><tr><th>赛事</th><th>时间</th><th>地点 / 场馆</th><th>规模</th><th>奖金池</th><th>结果</th></tr></thead>
        <tbody>
          <tr><td class="kb-win">圣地亚哥大师赛</td><td>2/28 – 3/16</td><td>智利 · Espacio Riesco</td><td>12 队</td><td class="kb-score">$1,000,000</td><td><span class="kb-gold">NS RedForce</span> 3:0 Paper Rex<br><span class="kb-small">MVP: Dambi</span></td></tr>
          <tr><td class="kb-win">伦敦大师赛</td><td>6/6 – 6/21</td><td>英国 · Copper Box Arena</td><td>12 队</td><td class="kb-score">$1,000,000</td><td><span class="kb-gold">LEVIATÁN</span> 3:2 Paper Rex<br><span class="kb-small">MVP: Neon</span></td></tr>
          <tr><td class="kb-win">上海全球冠军赛</td><td>9/24 – 10/18</td><td>中国 · 静安体育中心 + 梅奔文化中心</td><td>16 队</td><td class="kb-score">$2,250,000</td><td class="kb-dim">尚未举行</td></tr>
        </tbody>
      </table>
    </div>

    ${App._kbInfo('<b>历史意义：</b> 圣地亚哥 = VCT 首次在拉美举办全球赛事；伦敦 = 英国首次承办；上海 = 中国首次承办全球冠军赛。')}

    <h3 class="kb-h3">2026 赛季五大变化</h3>
    <div class="kb-grid kb-g2">
      ${App._kbCard(`<h4 class="kb-h4">1 · 启点赛改为三败淘汰制</h4><p style="margin-bottom:0">三个组别各产生一支晋级队伍，连续三天各送出一个大师赛席位。</p>`)}
      ${App._kbCard(`<h4 class="kb-h4">2 · 首站大师赛扩至 12 队</h4><p style="margin-bottom:0">此前首站仅 8 队，2026 起与第二站统一为 12 队、统一赛制。</p>`)}
      ${App._kbCard(`<h4 class="kb-h4">3 · 挑战者赛直通全球冠军赛</h4><p style="margin-bottom:0">每赛区 4 支挑战者赛队伍可进入第二赛段入围赛，理论上可直争冠军赛席位。</p>`)}
      ${App._kbCard(`<h4 class="kb-h4">4 · 第二赛段季后赛全面线下化</h4><p style="margin-bottom:0">四大赛区第二赛段季后赛均以线下锦标赛形式落地，较 2025 年线下赛事数量翻倍。</p>`)}
      ${App._kbCard(`<h4 class="kb-h4">5 · 常规赛场次均等化</h4><p style="margin-bottom:0">确保各队进入季后赛前的比赛场数均等，提升公平性。</p>`)}
      ${App._kbCard(`<h4 class="kb-h4">6 · 晋升赛机制过渡</h4><p style="margin-bottom:0">除 CN 赛区外晋升赛暂停，被"挑战者赛通往冠军赛之路"取代。</p>`)}
    </div>

    <h3 class="kb-h3">VCT CN 联赛 · V26 无畏巡回（七城）</h3>
    <div class="kb-tbl-wrap">
      <table class="kb-tbl">
        <thead><tr><th>站点</th><th>时间</th><th>赛事环节</th><th>说明</th></tr></thead>
        <tbody>
          <tr><td class="kb-win">广州站</td><td class="kb-y">1 月</td><td>启点赛</td><td>首次三败淘汰制，3 队晋级圣地亚哥大师赛</td></tr>
          <tr><td class="kb-win">杭州站</td><td class="kb-y">3/31 – 4/19</td><td>第一赛段常规赛</td><td>西湖体育馆，12 队分组单循环</td></tr>
          <tr><td class="kb-win">北京站</td><td class="kb-y">5 月</td><td>第一赛段季后赛</td><td>8 队双败淘汰，前 3 名晋级伦敦大师赛</td></tr>
          <tr><td class="kb-win">长沙站</td><td class="kb-y">7/9 – 7/26</td><td>第二赛段常规赛</td><td>贺龙体育馆</td></tr>
          <tr><td class="kb-win">成都站</td><td class="kb-y">8 月</td><td>入围赛 + 季后赛</td><td>决出年度总冠军"花火奖杯"</td></tr>
          <tr><td class="kb-win">上海站</td><td class="kb-y">9/24 – 10/18</td><td>全球冠军赛</td><td>CN 赛区 4 支队伍参赛</td></tr>
          <tr><td class="kb-win">待公布</td><td class="kb-y">年末</td><td>源能邀请赛</td><td>一座滨海城市承办</td></tr>
        </tbody>
      </table>
    </div>
  `);
};

/* ---------- 09 2027 改制 ---------- */
App._kbFuture2027 = function(){
  return App._kbSection('future2027','09','2027 赛季改制前瞻','Riot Games 于 2026 年 4 月 8 日公布，项目史上最大幅度的结构改革', `
    ${App._kbCard(`<p style="margin-bottom:0">2027 赛季起，VCT 将从<strong>封闭特许联赛</strong>转向<strong>以锦标赛为核心的开放生态</strong>。改革三条原则：每一场比赛都应有分量 · 通往全球赛事的道路应对所有队伍开放 · 线下赛事应走向更多城市。</p>`)}

    <div class="kb-grid kb-g2">
      ${App._kbCard(`
        <h4 class="kb-h4">核心结构</h4>
        <div class="kb-flow">
          <span class="kb-flow-node">公开入围赛</span><span class="kb-flow-arrow">→</span>
          <span class="kb-flow-node kb-flow-rg">杯赛 Cups</span><span class="kb-flow-arrow">→</span>
          <span class="kb-flow-node kb-flow-gl">大师赛 / 冠军赛</span>
        </div>
        <ul class="kb-list">
          <li><b>取消常规赛联赛</b>，由线下杯赛取代</li>
          <li>每赛区每年 <b>2 场杯赛</b>，全球共 <b>8 场</b></li>
          <li>杯赛冠军<b>直接晋级</b>大师赛与全球冠军赛</li>
        </ul>
      `)}
      ${App._kbCard(`
        <h4 class="kb-h4">全球规模</h4>
        <ul class="kb-list">
          <li>全年 <b>20+ 场</b>锦标赛</li>
          <li>足迹覆盖 <b>16 座以上</b>城市</li>
          <li>公开入围赛于上一年<b>第四季度</b>举行</li>
        </ul>
      `)}
      ${App._kbCard(`
        <h4 class="kb-h4">经济模型</h4>
        <ul class="kb-list">
          <li>锦标赛奖金池年总额超 <b>600 万美元</b></li>
          <li>全球赛事<b>差旅费用全额承担</b></li>
          <li>非合作队伍晋级补贴：杯赛 $100K、大师赛 $200K、冠军赛 $400K</li>
          <li>2025 年数字商品与队伍分成超 <b>8,600 万美元</b></li>
        </ul>
      `)}
      ${App._kbCard(`
        <h4 class="kb-h4">全新两年合作伙伴模式</h4>
        <ul class="kb-list">
          <li>合作周期改为<b>两年</b></li>
          <li>各主要赛区合作战队收缩至 <b>8 支</b></li>
          <li>合作队伍<b>不再自动获得</b>杯赛资格</li>
        </ul>
      `)}
    </div>
    ${App._kbNote('<b>官方表述：</b> VALORANT 电竞全球负责人 Leo Faria 将其描述为"重新想象队伍的竞争方式与粉丝的观赛体验"。')}
  `);
};

/* ---------- 10 合作伙伴 ---------- */
App._kbPartners = function(){
  return App._kbSection('partners','10','官方合作伙伴','2026 赛季全球与赛区级商业合作方', `
    <h3 class="kb-h3">全球合作伙伴（2026）</h3>
    ${App._kbCard(`
      <div>
        ${['AWS','Coinbase','EWC','Globant','HyperX','Mastercard','OMEN','Red Bull','Secretlab','Verizon'].map(p => App._kbTag('b',p)).join('')}
      </div>
    `)}

    <h3 class="kb-h3">合作方角色说明</h3>
    <div class="kb-tbl-wrap">
      <table class="kb-tbl">
        <thead><tr><th>合作方</th><th>身份 / 角色</th></tr></thead>
        <tbody>
          <tr><td class="kb-win">Red Bull 红牛</td><td>VCT <strong>官方能量饮料</strong>，冠名"Clutch Moment"播出环节</td></tr>
          <tr><td class="kb-win">Verizon</td><td><strong>官方 5G 与无线服务提供商</strong>，冠名 Game Changers 北美赛事</td></tr>
          <tr><td class="kb-win">Secretlab</td><td><strong>官方电竞椅</strong>提供方</td></tr>
          <tr><td class="kb-win">HP / OMEN + HyperX</td><td><strong>官方硬件提供方</strong> — 台式机、笔记本、耳机</td></tr>
          <tr><td class="kb-win">ZOWIE</td><td><strong>官方显示器</strong>合作伙伴（VCT 美洲联赛）</td></tr>
          <tr><td class="kb-win">Samsung 三星</td><td><strong>官方家庭娱乐合作伙伴</strong>（VCT 美洲联赛）</td></tr>
          <tr><td class="kb-win">AMD</td><td><strong>VCT CN 官方合作伙伴</strong>，锐龙 7 9800X3D + RX 9070 XT 赛事指定平台</td></tr>
          <tr><td class="kb-win">Mastercard</td><td>全球合作伙伴，持卡人优先购票等权益</td></tr>
          <tr><td class="kb-win">AWS</td><td>云服务与赛事数据支持</td></tr>
          <tr><td class="kb-win">ExpressVPN</td><td>2026 年新加入，粉丝专属掉宝与网络安全推广</td></tr>
        </tbody>
      </table>
    </div>
  `);
};

/* ---------- 11 转播平台 ---------- */
App._kbBroadcast = function(){
  return App._kbSection('broadcast','11','转播平台与观赛渠道','全球官方直播、共同直播生态与中国大陆转播矩阵', `
    <div class="kb-grid kb-g2">
      ${App._kbCard(`
        <h4 class="kb-h4">全球官方直播</h4>
        <ul class="kb-list">
          <li><b>Twitch</b> — twitch.tv/valorant</li>
          <li><b>YouTube</b> — @ValorantEsports</li>
          <li><b>官方网站</b> — valorantesports.com</li>
          <li>社交渠道 — X、Instagram、TikTok、Flickr</li>
        </ul>
      `)}
      ${App._kbCard(`
        <h4 class="kb-h4">共同直播生态</h4>
        <p>Riot 开放共同直播授权，创作者构成重要观赛入口。</p>
        <ul class="kb-list">
          <li>2025 巴黎冠军赛中 <b>58.4% 观看时长来自共同直播</b></li>
          <li>代表创作者 — tarik、FNS、OhnePixel</li>
          <li>葡语与日语频道峰值达 <b>17.9 万</b>与 <b>13.4 万</b></li>
        </ul>
      `)}
    </div>

    <h3 class="kb-h3">中国大陆转播矩阵</h3>
    ${App._kbCard(`
      <h4 class="kb-h4">官方自有渠道</h4>
      <div>${['赛事官网 vct.qq.com','无畏契约启动器','掌上无畏契约','掌上英雄联盟','WeGame'].map(t => App._kbTag('a',t)).join('')}</div>
      <h4 class="kb-h4" style="margin-top:14px">直播与视频平台</h4>
      <div>${['虎牙直播','哔哩哔哩','斗鱼直播','抖音','小红书','腾讯视频','腾讯体育','新浪微博','微信视频号','百视通'].map(t => App._kbTag('t',t)).join('')}</div>
      <p class="kb-small kb-dim" style="margin-top:12px;margin-bottom:0">国服赛事运营方为腾竞体育。各站平台清单以官方每站公告为准。</p>
    `)}

    <h3 class="kb-h3">购票渠道参考</h3>
    <div class="kb-tbl-wrap">
      <table class="kb-tbl">
        <thead><tr><th>赛事</th><th>售票渠道</th><th>票价参考</th></tr></thead>
        <tbody>
          <tr><td class="kb-win">2026 伦敦大师赛</td><td>Ticketmaster（2026/3/26 开票）</td><td>£10 – £125</td></tr>
          <tr><td class="kb-win">2026 上海全球冠军赛</td><td>官方公告为准</td><td class="kb-dim">请勿轻信非官方"预售票"</td></tr>
          <tr><td class="kb-win">VCT CN 各站</td><td>官方指定售票平台</td><td>依站点公告</td></tr>
        </tbody>
      </table>
    </div>
  `);
};

/* ---------- 12 里程碑 ---------- */
App._kbMilestones = function(){
  return App._kbSection('milestones','12','重要赛事节点与纪录','值得记录的历史时刻、数据纪录与赛区里程碑', `
    <h3 class="kb-h3">历史"首次"</h3>
    <div class="kb-tbl-wrap">
      <table class="kb-tbl">
        <thead><tr><th>时间</th><th>事件</th></tr></thead>
        <tbody>
          <tr><td class="kb-y">2020</td><td>先锋赛（First Strike）成功举办，为 VCT 体系奠基</td></tr>
          <tr><td class="kb-y">2021</td><td><strong>雷克雅未克大师赛</strong>成为 VCT 首个国际赛事</td></tr>
          <tr><td class="kb-y">2021.12</td><td><strong>柏林全球冠军赛</strong>诞生首位世界冠军 Acend</td></tr>
          <tr><td class="kb-y">2023</td><td>国际联赛与合作战队制启用；圣保罗季前邀请赛</td></tr>
          <tr><td class="kb-y">2024</td><td><strong>VCT CN 联赛成立</strong>；EDG 为 CN 赛区赢得首个世界冠军</td></tr>
          <tr><td class="kb-y">2026.3</td><td>圣地亚哥大师赛 — VCT 全球赛事<strong>首次落地拉美</strong></td></tr>
          <tr><td class="kb-y">2026.6</td><td>伦敦大师赛 — <strong>英国首次</strong>承办；LEV 以 19.6 岁成<strong>史上最年轻冠军战队</strong></td></tr>
          <tr><td class="kb-y">2026.9</td><td>上海全球冠军赛 — <strong>中国首次</strong>承办 VALORANT 全球冠军赛</td></tr>
        </tbody>
      </table>
    </div>

    <h3 class="kb-h3">选手与战队纪录</h3>
    <div class="kb-grid kb-g2">
      ${App._kbCard(`<h4 class="kb-h4">个人纪录</h4><ul class="kb-list"><li><b>Chronicle</b> — 三夺 VCT 国际赛冠军</li><li><b>Ethan</b> — <b>首位两夺全球冠军赛</b>的选手</li><li><b>aspas</b> — 单图 <b>47 杀</b>历史纪录</li></ul>`)}
      ${App._kbCard(`<h4 class="kb-h4">战队纪录</h4><ul class="kb-list"><li><b>全球冠军赛五届五冠</b> — 至今无人卫冕</li><li><b>G2 Esports</b> — 美洲赛区四连冠</li><li><b>Paper Rex</b> — 2026 连续两站大师赛亚军 + 2025 多伦多冠军</li></ul>`)}
    </div>

    <h3 class="kb-h3">经典战役与观赛数据</h3>
    <div class="kb-tbl-wrap">
      <table class="kb-tbl">
        <thead><tr><th>赛事</th><th>看点</th></tr></thead>
        <tbody>
          <tr><td class="kb-win">2025 巴黎冠军赛<br><span class="kb-small">NRG 3:2 Fnatic</span></td><td>NRG 零败场夺冠。Fnatic 第三图从 1:11 翻盘至 15:13——VCT 史上最大逆转之一。峰值 <b>147 万</b>观众，VCT 史上第三高。</td></tr>
          <tr><td class="kb-win">2026 圣地亚哥大师赛<br><span class="kb-small">NS RedForce 3:0 Paper Rex</span></td><td>升班马全胜夺冠。CN 赛区 All Gamers 从 2:8 落后翻盘击败 M8，跻身六强。峰值超 <b>88.3 万</b>观众。</td></tr>
          <tr><td class="kb-win">2026 伦敦大师赛<br><span class="kb-small">LEVIATÁN 3:2 Paper Rex</span></td><td>LEV 从败者组逆袭。CN 赛区新纪录：<strong>EDG 与 XLG 双队会师六强</strong>，EDG 获季军。</td></tr>
        </tbody>
      </table>
    </div>

    <h3 class="kb-h3">奖金池演变</h3>
    <div class="kb-tbl-wrap">
      <table class="kb-tbl kb-pts">
        <thead><tr><th>赛事级别</th><th>总奖金池</th><th>冠军</th><th>亚军</th><th>季军</th><th>殿军</th></tr></thead>
        <tbody>
          <tr><td>大师赛（2026 单站）</td><td class="kb-v">$1,000,000</td><td class="kb-v">$350,000</td><td class="kb-v">$200,000</td><td class="kb-v">$125,000</td><td class="kb-v">$75,000</td></tr>
          <tr><td>全球冠军赛</td><td class="kb-v">$2,250,000</td><td colspan="4" class="kb-dim">按名次分配，官方逐届公布</td></tr>
          <tr><td>2027 锦标赛体系</td><td class="kb-v">$6,000,000+/年</td><td colspan="4" class="kb-dim">另含全额差旅与晋级补贴</td></tr>
        </tbody>
      </table>
    </div>
  `);
};

/* ---------- 页脚 ---------- */
App._kbFooter = function(){
  return `
  <div class="kb-footer">
    <h4>资料来源（公开可查）</h4>
    <div class="kb-src">
      <span><b>官方一手</b> — valorantesports.com 联赛手册、playvalorant.com 电竞公告、vct.qq.com 赛事官网</span>
      <span><b>官方赛事署名</b> — VCT 官方转播频道对 2026 赛季合作伙伴的公开列示</span>
      <span><b>新闻媒体</b> — 中新网、中国日报、腾讯新闻 / 腾讯体育、IT之家</span>
      <span><b>电竞垂直媒体</b> — vlr.gg、thespike.gg、dotesports.com、Esports Charts</span>
      <span><b>百科与 Wiki</b> — 百度百科、bilibili 无畏契约 WIKI、萌娘百科</span>
    </div>
    <p style="margin-top:14px;margin-bottom:0">本知识库整理自互联网公开信息，资料截至 <b>2026 年 8 月 14 日</b>。如需权威数值，建议以 Riot Games 官方公告及 valorantesports.com 联赛手册为准。</p>
  </div>`;
};
