/* =====================================================
 * data.js — 日期工具 + “官方赛程接口”（演示模拟）
 * 赛程数据来源（2026-08-19 抓取）：
 *  · VCT CN 第二赛段入围赛 & 季后赛（成都，8/5–8/23）
 *    —— 对阵与开赛时间取自 VLR.gg / VCT 官网
 *  · 2026 上海全球冠军赛（9/24–10/18，梅赛德斯-奔驰文化中心）
 *    —— 赛制框架为官方已公布信息；逐日对阵 9/7 抽签后确定，
 *       当前按框架推演（总决赛 10/18 BO5），同步后可自动/手动修正
 * 真实环境中 fetchRemoteSchedule() 可替换为
 * 调用赛程数据方 API（如赛程开放平台 / 内部赛程系统）
 * ===================================================== */

/* ---------- 日期工具 ---------- */
const D = {
  fmt(d){
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  },
  parse(s){
    const [y,m,d] = s.split('-').map(Number);
    return new Date(y, m-1, d);
  },
  today(){ return D.fmt(new Date()); },
  addDays(s, n){
    const d = D.parse(s); d.setDate(d.getDate()+n); return D.fmt(d);
  },
  weekdayCN(s){ return '日一二三四五六'[D.parse(s).getDay()]; },
  monthDays(y, m){ // m: 1~12 → ['YYYY-MM-DD', ...]
    const n = new Date(y, m, 0).getDate(), out = [];
    for(let i=1;i<=n;i++) out.push(y + '-' + String(m).padStart(2,'0') + '-' + String(i).padStart(2,'0'));
    return out;
  },
  ym(s){ const [y,m] = s.split('-').map(Number); return {y, m}; },
  ts(){ // 通知时间戳显示
    const d = new Date();
    return String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + ' ' +
           String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  },
  dateCN(s){ return D.parse(s).getMonth()+1 + '月' + D.parse(s).getDate() + '日'; }
};

/* ---------- 赛事定义 ---------- */
const LEAGUE     = 'VCT 2026 无畏契约冠军巡回赛';
const CN_LEAGUE  = 'VCT CN 2026 第二赛段';
const INTL_EVENT = '2026 上海全球冠军赛';

/* ---------- VCT CN 第二赛段：入围赛 & 季后赛（成都） ----------
 * 8/5–8/12 入围赛（城北体育馆，十进四双败淘汰）
 * 8/14–8/16 季后赛前三日  8/17–18 转场休赛
 * 8/19–8/23 季后赛后五日（金融城演艺中心），败决与总决赛 BO5
 */
const CN_PLAYOFF = [
  ['2026-08-05', [ ['16:00','入围赛·第一轮','BO3','TE vs AT'],
                   ['18:00','入围赛·第一轮','BO3','TEC vs KBG'] ]],
  ['2026-08-06', [ ['16:00','入围赛·胜者组八强','BO3','FPX vs JDG'],
                   ['19:00','入围赛·胜者组八强','BO3','WOL vs DRG'] ]],
  ['2026-08-07', [ ['16:00','入围赛·胜者组八强','BO3','AG vs TE'],
                   ['19:00','入围赛·胜者组八强','BO3','EDG vs TEC'] ]],
  ['2026-08-08', [ ['16:00','入围赛·败者组第一轮','BO3','AT vs WOL'],
                   ['19:35','入围赛·败者组第一轮','BO3','KBG vs FPX'] ]],
  ['2026-08-09', [ ['16:00','入围赛·败者组第二轮','BO3','EDG vs WOL'],
                   ['19:25','入围赛·败者组第二轮','BO3','TE vs FPX'] ]],
  ['2026-08-10', [ ['16:00','入围赛·胜者组半决赛','BO3','AG vs JDG'],
                   ['18:40','入围赛·胜者组半决赛','BO3','TEC vs DRG'] ]],
  ['2026-08-11', [ ['16:00','入围赛·败者组第三轮','BO3','JDG vs EDG'],
                   ['18:05','入围赛·败者组第三轮','BO3','DRG vs TE'] ]],
  ['2026-08-12', [ ['16:00','入围赛·胜者组决赛','BO3','AG vs TEC'],
                   ['19:45','入围赛·败者组决赛','BO3','JDG vs TE'] ]],
  ['2026-08-14', [ ['16:00','季后赛·胜者组第一轮','BO3','NOVA vs JDG'],
                   ['18:30','季后赛·胜者组第一轮','BO3','TYL vs TEC'] ]],
  ['2026-08-15', [ ['16:00','季后赛·胜者组第一轮','BO3','BLG vs TE'],
                   ['19:30','季后赛·胜者组第一轮','BO3','XLG vs AG'] ]],
  ['2026-08-16', [ ['16:00','季后赛·败者组第一轮','BO3','TEC vs NOVA'],
                   ['18:35','季后赛·败者组第一轮','BO3','AG vs TE'] ]],
  ['2026-08-19', [ ['16:00','季后赛·胜者组半决赛','BO3','TYL vs JDG'],
                   ['19:00','季后赛·胜者组半决赛','BO3','XLG vs BLG'] ]],
  ['2026-08-20', [ ['16:00','季后赛·败者组第二轮','BO3','NOVA vs 待定'],
                   ['18:00','季后赛·败者组第二轮','BO3','AG vs 待定'] ]],
  ['2026-08-21', [ ['16:00','季后赛·胜者组决赛','BO3','待定 vs 待定'],
                   ['18:00','季后赛·败者组第三轮','BO3','待定 vs 待定'] ]],
  ['2026-08-22', [ ['16:00','季后赛·败者组决赛','BO5','待定 vs 待定'] ]],
  ['2026-08-23', [ ['16:00','年度总决赛','BO5','待定 vs 待定'] ]]
];

/* ---------- 上海全球冠军赛（9/24–10/18，框架日程） ----------
 * 16 队 4 组双败小组赛（每组 5 场，共 20 场，全部 BO3）
 * 8 强双败淘汰赛；败者组决赛与总决赛 BO5
 * 种子对阵以 9/7 抽签为准，抽签后由官方同步更新
 */
const INTL_GROUP_DAYS = 10;   // 9/24–10/3，每日 2 场小组赛
const INTL_PLAYOFF = [
  ['2026-10-08', [ ['15:00','淘汰赛·胜者组第一轮','BO3','小组第一 vs 小组第二'],
                   ['18:00','淘汰赛·胜者组第一轮','BO3','小组第一 vs 小组第二'] ]],
  ['2026-10-09', [ ['15:00','淘汰赛·胜者组第一轮','BO3','小组第一 vs 小组第二'],
                   ['18:00','淘汰赛·胜者组第一轮','BO3','小组第一 vs 小组第二'] ]],
  ['2026-10-10', [ ['15:00','淘汰赛·败者组第一轮','BO3','胜者组第一轮败者对决'],
                   ['18:00','淘汰赛·败者组第一轮','BO3','胜者组第一轮败者对决'] ]],
  ['2026-10-11', [ ['15:00','淘汰赛·胜者组第二轮','BO3','待定 vs 待定'],
                   ['18:00','淘汰赛·胜者组第二轮','BO3','待定 vs 待定'] ]],
  ['2026-10-12', [ ['15:00','淘汰赛·败者组第二轮','BO3','待定 vs 待定'],
                   ['18:00','淘汰赛·败者组第二轮','BO3','待定 vs 待定'] ]],
  ['2026-10-14', [ ['16:00','淘汰赛·胜者组决赛','BO3','待定 vs 待定'] ]],
  ['2026-10-15', [ ['16:00','淘汰赛·败者组半决赛','BO3','待定 vs 待定'] ]],
  ['2026-10-16', [ ['16:00','淘汰赛·败者组决赛','BO5','待定 vs 待定'] ]],
  ['2026-10-18', [ ['17:00','总决赛','BO5','待定 vs 待定'] ]]
];

/* 生成冠军赛小组赛 20 场（A–D 组，每组：胜者组R1×2 → 败者组R1 → 胜者组R2 → 败者组R2） */
function intlGroupMatches(){
  const rounds = ['胜者组第一轮','胜者组第一轮','败者组第一轮','胜者组第二轮','败者组第二轮'];
  const pair = ['1号种子 vs 4号种子','2号种子 vs 3号种子','首轮败者对决','组内头名之战','小组第二之争'];
  const out = [];
  'ABCD'.split('').forEach(g => {
    rounds.forEach((r, i) => out.push({ time: out.length % 2 ? '18:00' : '15:00',
      stage: '小组赛·' + g + '组·' + r, bo: 'BO3', teams: g + '组 ' + pair[i] }));
  });
  return out;
}

/* ---------- 基础赛程（rev 0） ---------- */
function baseCalendar(){
  const days = {};
  // 全区间 2026-08-01 ~ 2026-10-18 默认休赛
  for(let d = D.parse('2026-08-01'); d <= D.parse('2026-10-18'); d.setDate(d.getDate()+1)){
    days[D.fmt(d)] = { type:'rest', manual:false, matches:[] };
  }
  const put = (event, list) => list.forEach(([ds, ms]) => {
    days[ds] = { type:'match', manual:false,
      matches: ms.map(([time, stage, bo, teams]) =>
        ({ time, name: event + ' ' + stage, stage, bo, teams })) };
  });

  // VCT CN 第二赛段（成都）
  put(CN_LEAGUE, CN_PLAYOFF);

  // 上海全球冠军赛：小组赛
  const gm = intlGroupMatches();
  for(let i = 0; i < INTL_GROUP_DAYS; i++){
    const ds = D.addDays('2026-09-24', i);
    days[ds] = { type:'match', manual:false,
      matches: gm.slice(i*2, i*2+2).map(m =>
        ({ time: m.time, name: INTL_EVENT + ' ' + m.stage, stage: m.stage, bo: m.bo, teams: m.teams })) };
  }
  // 上海全球冠军赛：淘汰赛
  put(INTL_EVENT, INTL_PLAYOFF);

  return days;
}

/* 官方赛程变更脚本：每同步一次应用一条，用于演示“赛程变更后的同步更新” */
const OFFICIAL_CHANGES = [
  { rev:1, date:'2026-08-23', action:'reschedule',
    desc:'官方调整：8月23日 VCT CN 年度总决赛开赛时间调整为 17:00',
    apply(c){ const d = c['2026-08-23']; if(d && d.matches) d.matches[0].time = '17:00'; } },
  { rev:2, date:'2026-10-15', action:'reschedule',
    desc:'官方调整：10月15日败者组半决赛延期，与10月14日胜者组决赛同日进行',
    apply(c){
      const m = (c['2026-10-15'] || {}).matches;
      if(m && m.length){
        c['2026-10-14'].matches.push(Object.assign({}, m[0], { time:'19:30' }));
        c['2026-10-15'] = { type:'rest', manual:false, matches:[] };
      }
    } },
  { rev:3, date:'2026-10-17', action:'addMatch',
    desc:'官方新增：10月17日增设全明星表演赛（上海站观众互动日）',
    apply(c){ c['2026-10-17'] = { type:'match', manual:false, matches:[{ time:'19:00', name: INTL_EVENT + ' 全明星表演赛', stage:'全明星表演赛', bo:'BO3', teams:'全明星红队 vs 全明星蓝队' }] }; } }
];

/* 返回指定 rev 的完整官方赛历 */
function calendarAtRev(rev){
  const c = baseCalendar();
  for(let i=0; i<rev && i<OFFICIAL_CHANGES.length; i++) OFFICIAL_CHANGES[i].apply(c);
  return c;
}

/* 模拟远程赛程接口（延迟 600ms）。rev = 客户端已同步到的版本 */
function fetchRemoteScheduleMock(rev){
  return new Promise(resolve => {
    setTimeout(() => resolve({ rev, days: calendarAtRev(rev) }), 600);
  });
}

/* 真实赛程接口：
 * 云端模式（GitHub Pages）→ 读 data/fetched-schedule.json（由 GitHub Actions 定时更新）
 * 本地模式 → 从服务器拉取 VLR 抓取结果，失败降级到模拟接口
 * rev 参数保留用于离线降级时的模拟版本控制。 */
function fetchRemoteSchedule(rev){
  /* 云端模式：读取 GitHub Actions 提交的静态赛程文件 */
  if(typeof window !== 'undefined' && CLOUD.isCloudMode()){
    return fetch('data/fetched-schedule.json')
      .then(r => r.json())
      .then(result => {
        if(!result || !result.days) throw new Error('no schedule data');
        // 以基础赛历为底（含冠军赛框架），用 VLR 数据覆盖对应日期
        const merged = calendarAtRev(0);
        let updated = 0;
        for(const [ds, info] of Object.entries(result.days)){
          if(merged[ds] && merged[ds].manual) continue;
          merged[ds] = info;
          updated++;
        }
        return { rev, days: merged, source:'vlr', updated, fetchedAt: result.fetchedAt };
      })
      .catch(err => {
        console.warn('[赛程同步] 静态赛程文件加载失败，降级到本地模拟:', err.message);
        return fetchRemoteScheduleMock(rev);
      });
  }

  /* 本地模式：浏览器环境且服务器在线时走真实 API */
  if(typeof window !== 'undefined' && window.fetch){
    return fetch('/api/schedule-fetch', { method:'POST' })
      .then(r => r.json())
      .then(result => {
        if(!result || !result.days || result.error){
          throw new Error(result && result.error || 'empty response');
        }
        // 以基础赛历为底（含冠军赛框架），用 VLR 数据覆盖对应日期
        const merged = calendarAtRev(0);
        let updated = 0;
        for(const [ds, info] of Object.entries(result.days)){
          // 不覆盖手动修正的日期
          if(merged[ds] && merged[ds].manual) continue;
          merged[ds] = info;
          updated++;
        }
        // 标记没有比赛的日期为休赛日（VLR 未返回的日期保持基础赛历不变）
        return { rev, days: merged, source:'vlr', updated, fetchedAt: result.fetchedAt };
      })
      .catch(err => {
        console.warn('[赛程同步] 服务器抓取失败，降级到本地模拟:', err.message);
        return fetchRemoteScheduleMock(rev);
      });
  }
  // Node 环境（无 fetch）直接用模拟
  return fetchRemoteScheduleMock(rev);
}
