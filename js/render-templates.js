/* =====================================================
 * render-templates.js — 三张默认模板种子壳
 * 与 data/render-templates.json 同内容；运行时由 store.seedState
 * 直接调用（避免 JSON 异步加载影响启动顺序）。
 * 坐标均为「设计坐标系」，导出时由 scale 等比放大（见规格 3.6）。
 * 底图 base 由管理员在后台上传；此处留空，渲染时缺底图退化为透明底。
 * ===================================================== */
function RENDER_TEMPLATES_SEED(){
  return [
    /* ---------- ① 今日预告（竖版） ---------- */
    {
      id: 'preview-portrait-v1',
      name: '今日预告(竖版)',
      kind: 'preview',
      orientation: 'portrait',
      size: { w: 1080, h: 1620 },
      exportScale: 1,
      base: '',
      lang: ['zh', 'en'],
      createdBy: 'system',
      meta: {
        title: '赛事预告', titleEn: 'MATCH PREVIEW',
        subtitle: 'TOURNAMENT PREVIEW', subtitleEn: 'TOURNAMENT PREVIEW'
      },
      groups: {
        match: { repeatDirection: 'vertical', repeatGap: 160, maxCount: 3, stride: 320 }
      },
      slots: [
        { key:'title', type:'text', group:'static', x:60, y:80, w:960, h:80, align:'center', font:'Noto Sans SC', weight:700, size:60, color:'#ffffff', source:'meta.title', editable:true, defaultValue:'赛事预告', staticText:'赛事预告', createdBy:'system' },
        { key:'subtitle', type:'text', group:'static', x:60, y:175, w:960, h:40, align:'center', font:'Noto Sans SC', weight:400, size:28, color:'#ffffff', source:'meta.subtitle', editable:true, defaultValue:'TOURNAMENT PREVIEW', staticText:'TOURNAMENT PREVIEW', createdBy:'system' },
        { key:'date', type:'text', group:'static', x:60, y:240, w:960, h:60, align:'center', font:'Noto Sans SC', weight:400, size:48, color:'#ffffff', source:'meta.date', editable:true, defaultValue:'8月21日', createdBy:'system' },
        { key:'weekday', type:'text', group:'static', x:60, y:310, w:960, h:40, align:'center', font:'Noto Sans SC', weight:400, size:30, color:'#ffffff', source:'meta.weekday', editable:true, defaultValue:'星期五', createdBy:'system' },
        { key:'matchA_logo', type:'image', group:'match', x:300, y:420, w:160, h:160, shape:'circle', source:'matches[i].teamA.logo', editable:false, createdBy:'system' },
        { key:'matchA_name', type:'text', group:'match', x:220, y:590, w:320, h:40, align:'center', font:'Noto Sans SC', weight:400, size:30, color:'#ffffff', source:'matches[i].teamA.shortName', editable:true, defaultValue:'TBD', createdBy:'system' },
        { key:'match_vs', type:'text', group:'match', x:470, y:480, w:140, h:50, align:'center', font:'Noto Sans SC', weight:700, size:36, color:'#ffffff', source:'literal', staticText:'VS', editable:false, createdBy:'system' },
        { key:'matchB_logo', type:'image', group:'match', x:620, y:420, w:160, h:160, shape:'circle', source:'matches[i].teamB.logo', editable:false, createdBy:'system' },
        { key:'matchB_name', type:'text', group:'match', x:540, y:590, w:320, h:40, align:'center', font:'Noto Sans SC', weight:400, size:30, color:'#ffffff', source:'matches[i].teamB.shortName', editable:true, defaultValue:'TBD', createdBy:'system' },
        { key:'match_time', type:'text', group:'match', x:60, y:650, w:960, h:50, align:'center', font:'Noto Sans SC', weight:400, size:34, color:'#ffffff', source:'matches[i].time', editable:true, defaultValue:'00:00', createdBy:'system' }
      ]
    },

    /* ---------- ② 今日解说（横版） ---------- */
    {
      id: 'today-casters-v1',
      name: '今日解说(横版)',
      kind: 'casters',
      orientation: 'landscape',
      size: { w: 1920, h: 1080 },
      exportScale: 1,
      base: '',
      lang: ['zh', 'en'],
      createdBy: 'system',
      meta: {
        title: '今日解说', titleEn: "TODAY'S CASTERS",
        subtitle: "TODAY'S CASTERS", subtitleEn: "TODAY'S CASTERS"
      },
      groups: {
        match:  { repeatDirection: 'horizontal', repeatGap: 80, maxCount: 2, stride: 900 },
        caster: { matchIndex: 'any', repeatDirection: 'horizontal', repeatGap: 36, maxCount: 3, stride: 200 }
      },
      slots: [
        { key:'title', type:'text', group:'static', x:60, y:60, w:1800, h:90, align:'center', font:'Noto Sans SC', weight:700, size:60, color:'#ffffff', source:'meta.title', editable:true, defaultValue:'今日解说', createdBy:'system' },
        { key:'subtitle', type:'text', group:'static', x:60, y:160, w:1800, h:40, align:'center', font:'Noto Sans SC', weight:400, size:28, color:'#ffffff', source:'meta.subtitle', editable:true, createdBy:'system' },
        { key:'matchA_logo', type:'image', group:'match', x:120, y:280, w:160, h:160, shape:'circle', source:'matches[i].teamA.logo', editable:false, createdBy:'system' },
        { key:'matchB_logo', type:'image', group:'match', x:740, y:280, w:160, h:160, shape:'circle', source:'matches[i].teamB.logo', editable:false, createdBy:'system' },
        { key:'match_time', type:'text', group:'match', x:440, y:300, w:420, h:50, align:'center', font:'Noto Sans SC', weight:400, size:30, color:'#ffffff', source:'matches[i].time', editable:true, defaultValue:'00:00', createdBy:'system' },
        { key:'caster_portrait', type:'image', group:'caster', x:120, y:460, w:140, h:140, shape:'circle', source:'matches[i].casters[j].portrait', editable:false, createdBy:'system' },
        { key:'caster_name', type:'text', group:'caster', x:120, y:610, w:140, h:36, align:'center', font:'Noto Sans SC', weight:400, size:22, color:'#ffffff', source:'matches[i].casters[j].name', editable:true, defaultValue:'解说', createdBy:'system' },
        { key:'caster_role', type:'text', group:'caster', x:120, y:648, w:140, h:28, align:'center', font:'Noto Sans SC', weight:400, size:18, color:'#dddddd', source:'matches[i].casters[j].role', editable:true, defaultValue:'主解说', createdBy:'system' }
      ]
    },

    /* ---------- ③ 今日首发（横版） ---------- */
    {
      id: 'today-lineup-v1',
      name: '今日首发(横版)',
      kind: 'lineup',
      orientation: 'landscape',
      size: { w: 1920, h: 1080 },
      exportScale: 1,
      base: '',
      lang: ['zh', 'en'],
      createdBy: 'system',
      meta: {
        title: '', titleEn: '',
        subtitle: 'STARTING LINEUP', subtitleEn: 'STARTING LINEUP'
      },
      groups: {
        player: { repeatDirection: 'horizontal', repeatGap: 24, maxCount: 5, stride: 340 },
        coach:  { repeatDirection: 'vertical', repeatGap: 32, maxCount: 3, stride: 180 }
      },
      slots: [
        { key:'main_title', type:'text', group:'static', x:60, y:60, w:1400, h:80, align:'left', font:'Noto Sans SC', weight:800, size:64, color:'#ffffff', source:'team.nameEn', editable:true, defaultValue:'TEAM NAME', createdBy:'system' },
        { key:'sub_title', type:'text', group:'static', x:60, y:150, w:1400, h:40, align:'left', font:'Noto Sans SC', weight:400, size:28, color:'#ffffff', letterSpacing:6, source:'team.nameEn', editable:true, defaultValue:'TEAM', createdBy:'system' },
        { key:'team_logo', type:'image', group:'static', x:1560, y:60, w:300, h:300, shape:'rect', source:'team.logo', editable:false, createdBy:'system' },
        { key:'player_label', type:'text', group:'player', x:60, y:360, w:240, h:30, align:'center', font:'Noto Sans SC', weight:400, size:20, color:'#ffffff', source:'literal', staticText:'PLAYER', editable:false, createdBy:'system' },
        { key:'player_portrait', type:'image', group:'player', x:60, y:400, w:240, h:240, shape:'circle', source:'team.roster[i].avatar', editable:false, createdBy:'system' },
        { key:'player_id', type:'text', group:'player', x:60, y:660, w:240, h:40, align:'center', font:'Noto Sans SC', weight:400, size:30, color:'#ffffff', source:'team.roster[i].id', editable:true, defaultValue:'ID', createdBy:'system' },
        { key:'coach_label', type:'text', group:'static', x:60, y:720, w:200, h:30, align:'left', font:'Noto Sans SC', weight:400, size:20, color:'#ffffff', source:'literal', staticText:'COACH', editable:false, createdBy:'system' },
        { key:'coach_portrait', type:'image', group:'coach', x:60, y:760, w:120, h:120, shape:'circle', source:'team.coaches[i].avatar', editable:false, createdBy:'system' },
        { key:'coach_name', type:'text', group:'coach', x:200, y:765, w:260, h:40, align:'left', font:'Noto Sans SC', weight:400, size:26, color:'#ffffff', source:'team.coaches[i].name', editable:true, defaultValue:'教练', createdBy:'system' },
        { key:'coach_role', type:'text', group:'coach', x:200, y:805, w:260, h:30, align:'left', font:'Noto Sans SC', weight:400, size:18, color:'#bbbbbb', source:'team.coaches[i].role', editable:true, defaultValue:'主教练', createdBy:'system' }
      ]
    }
  ];
}
