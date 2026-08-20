/* build-kb-content.js — 将 view-kb.js 的静态内容预渲染为 data/kb-content.json
 * 用法: node scripts/build-kb-content.js
 * 生成后 view-kb.js 只保留框架代码，内容运行时 fetch 加载
 */
const fs = require('fs');
const path = require('path');

/* 浏览器环境桩 */
global.window = global;
global.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: () => ({})
};
global.App = {};

/* 加载 view-kb.js（eval 保持同一作用域，const 声明可见） */
const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'view-kb.js'), 'utf8');
eval(code);

/* 执行各内容函数，捕获输出 HTML */
const fnNames = [
  '_kbOverview','_kbSystem','_kbTimeline','_kbChampions','_kbRegions',
  '_kbPlayers','_kbFormat','_kbSeason2026','_kbFuture2027','_kbPartners',
  '_kbBroadcast','_kbMilestones','_kbFooter'
];

const sections = {};
let ok = 0;
for(const name of fnNames){
  if(typeof App[name] === 'function'){
    sections[name] = App[name]();
    ok++;
  } else {
    console.error('MISSING:', name);
  }
}

const out = path.join(__dirname, '..', 'data', 'kb-content.json');
fs.writeFileSync(out, JSON.stringify(sections, null, 1));
console.log(`OK: ${ok}/${fnNames.length} sections written to ${out}`);
console.log('Size:', fs.statSync(out).size, 'bytes');
