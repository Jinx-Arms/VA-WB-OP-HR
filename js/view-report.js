/* =====================================================
 * view-report.js — VCT 三大联赛赛况战报页面
 * ===================================================== */

App.renderReport = function(){
  const isAdmin = App.can('manage');
  const st = App.ui.report = App.ui.report || { league: 'EMEA', asOf: D.today(), winStart: '', md: '', groups: {} };

  const leagues = [
    { id: 'EMEA', label: 'EMEA 欧洲中东非洲' },
    { id: 'Americas', label: 'Americas 美洲' },
    { id: 'Pacific', label: 'Pacific 太平洋' }
  ];

  const leagueOpts = leagues.map(l => `<option value="${l.id}" ${st.league===l.id?'selected':''}>${l.label}</option>`).join('');

  /* 分组录入（MVP：手动填，阶段二接自动计算） */
  const g = st.groups || {};
  const groupForm = `
    <details style="margin:10px 0">
      <summary style="cursor:pointer;color:var(--accent)">⚙ 分组名单（ALPHA/OMEGA 直通+入围，手动录入）</summary>
      <div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label>ALPHA 直通2队（逗号）</label><input id="rg-ad" value="${(g.alphaDirect||[]).join(', ')}" placeholder="如 TL, GX"></div>
        <div><label>OMEGA 直通2队（逗号）</label><input id="rg-od" value="${(g.omegaDirect||[]).join(', ')}" placeholder="如 M8, VIT"></div>
        <div><label>ALPHA 入围4队（逗号）</label><input id="rg-ap" value="${(g.alphaPlayin||[]).join(', ')}" placeholder="如 NAVI, PCF, FNC, EF"></div>
        <div><label>OMEGA 入围4队（逗号）</label><input id="rg-op" value="${(g.omegaPlayin||[]).join(', ')}" placeholder="如 BBL, TH, FUT, KC"></div>
      </div>
      <div class="hint" style="margin-top:6px">分组名单由运营按积分榜手动录入（文档要求不得硬编码）。后续版本将接入常规赛赛果自动计算。</div>
    </details>`;

  const body = `
    <div class="card" style="margin-bottom:14px">
      <h3 class="card-title">赛况战报生成</h3>
      <div class="form-row">
        <div><label>联赛</label><select id="rp-league">${leagueOpts}</select></div>
        <div><label>截至日期 (as_of)</label><input id="rp-asof" type="date" value="${st.asOf}"></div>
        <div><label>赛果窗口起点</label><input id="rp-win" type="date" value="${st.winStart}" placeholder="如 2026-08-04"></div>
      </div>
      ${isAdmin ? groupForm : ''}
      <div style="margin-top:10px">
        <button class="btn primary" onclick="App.reportRun()">⚡ 生成战报</button>
        ${st.md ? `<button class="btn" onclick="App.reportCopy()">📋 复制</button>` : ''}
      </div>
    </div>
    ${st.md ? `<div class="card"><h3 class="card-title">预览（Markdown，可直接发布）</h3><pre style="white-space:pre-wrap;font-family:monospace;line-height:1.6">${escapeHtml(st.md)}</pre></div>` : '<div class="empty">填写参数后点击「生成战报」。</div>'}
  `;

  return body;
};

App.reportRun = async function(){
  const league = document.getElementById('rp-league').value;
  const asOf = document.getElementById('rp-asof').value || D.today();
  const winStart = document.getElementById('rp-win').value || asOf;

  /* 读取分组录入 */
  const split = (id) => (document.getElementById(id).value || '').split(',').map(s => s.trim()).filter(Boolean);
  const groups = {
    alphaDirect: split('rg-ad'), omegaDirect: split('rg-od'),
    alphaPlayin: split('rg-ap'), omegaPlayin: split('rg-op')
  };

  App.ui.report.league = league;
  App.ui.report.asOf = asOf;
  App.ui.report.winStart = winStart;
  App.ui.report.groups = groups;

  const md = await App.reportGenerate({ league, asOfDate: asOf, resultWindowStart: winStart, groups });
  if(md){
    App.ui.report.md = md;
    App.toast('战报已生成', 'ok');
  } else {
    App.ui.report.md = '';
  }
  App.renderView();
};

App.reportCopy = function(){
  const md = App.ui.report.md;
  if(!md) return;
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(md).then(() => App.toast('已复制到剪贴板', 'ok'), () => App.toast('复制失败，请手动选择', 'err'));
  } else {
    App.toast('当前环境不支持自动复制，请手动选择', 'warn');
  }
};

function escapeHtml(s){
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
