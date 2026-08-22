/* =====================================================
 * vct-teams.js — VCT 战队注册表加载器（48 队 + 2 挑战者队）
 * 浏览器全局 + Node.js require 双端兼容
 *
 * 种子数据已外置至 data/vct-teams-seed.json：
 *   - Node 端：require JSON（同步）
 *   - 浏览器端：App.init() 中 fetch 后赋值（在 App.load/seedState 之前完成）
 *
 * 数据结构（每队）：
 *   id / name / short / aliases / region / vlrId / rosterSeed[]
 *   rosterSeed 每人：id / name / country / role / joined / formerTeams
 * ===================================================== */
'use strict';

let VCT_TEAMS = [];

/* Node 端：同步 require JSON（server.js / scrape.js 走此路径）
 * UMD 判定：无 window 且有 module → Node；有 window → 浏览器 */
if(typeof window === 'undefined' && typeof module !== 'undefined' && module.exports){
  VCT_TEAMS = require('../data/vct-teams-seed.json');
}

/* 浏览器端：由 main.js App.init() 调用，在 load()/seedState 之前填充 */
if(typeof window !== 'undefined'){
  window.VCT_TEAMS_LOAD = async function(){
    try{
      const res = await fetch('data/vct-teams-seed.json');
      VCT_TEAMS = await res.json();
    }catch(e){
      /* 加载失败时保持空数组，state.teams 走 fetched 数据合并 */
    }
    return VCT_TEAMS;
  };
}

/* ---------- 将注册表转为 state.teams 对象格式 ---------- */
function VCT_TEAMS_SEED(){
  const obj = {};
  for(const t of VCT_TEAMS){
    obj[t.id] = {
      id: t.id,
      name: t.name,
      nameEn: t.name,
      shortName: t.short,
      shortNameEn: t.short,
      short: t.short,
      aliases: t.aliases || [],
      region: t.region,
      vlrId: t.vlrId || '',
      logo: '',
      roster: (t.rosterSeed || []).map(p => ({
        id: p.id,
        name: p.name,
        avatar: '',
        country: p.country,
        role: p.role,
        joined: p.joined || '',
        formerTeams: p.formerTeams || [],
        source: 'seed'
      })),
      coaches: [],
      manual: false,
      updatedAt: 0
    };
  }
  return obj;
}

/* ---------- 双端导出（仅 Node） ---------- */
if(typeof window === 'undefined' && typeof module !== 'undefined') module.exports = { VCT_TEAMS, VCT_TEAMS_SEED };
