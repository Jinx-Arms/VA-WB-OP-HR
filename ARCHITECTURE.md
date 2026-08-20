# ARCHITECTURE.md — 模块索引

> 每次对话开头读这个文件（~2KB），用 Grep + Read(offset,limit) 定位代码，
> 不要盲读整个文件。

## 路由表

| nav key | 渲染函数 | 文件:行 |
|---------|---------|---------|
| dash | App.renderDash() | main.js:474 |
| schedule | App.renderSchedule() | view-schedule.js:5 |
| roster | App.renderRoster() | view-roster.js:5 |
| staff | App.renderStaff() | view-staff.js:6 |
| content | App.renderContent() | view-content.js:9 |
| assign | App.renderAssign() | view-assign.js:6 |
| story | App.renderStory() | view-story.js:12 |
| kb | App.renderKB() | view-kb.js:6 |
| mine | App.renderMine() | view-mine.js:6 |

路由分发: main.js:419 `App.renderView()`
导航定义: main.js:321 `NAV[]`
导航切换: main.js:401 `App.nav(key)`

## 数据流

```
index.html
  → data.js (D工具, fetchRemoteSchedule, fetchRemoteTeams)
  → cloud.js (CLOUD Supabase适配层)
  → vct-teams.js (加载器: Node端require JSON / 浏览器端VCT_TEAMS_LOAD fetch)
  → store.js (App.state, seedState, save/load, 撤销重做)
  → view-*.js (各页面渲染, 返回HTML字符串)
  → story-engine.js (看点规则引擎)
  → main.js (App启动, 登录, 导航, 同步, Shell)
```

⚠️ App.init() 顺序: VCT_TEAMS_LOAD() fetch 战队JSON → App.load() →
   migrateAuth/eventCategories/shiftTypes/teams 迁移 → restoreSession → 渲染

## State 结构 (store.js:38 seedState)

```
App.state = {
  user, seq, remoteRev, lastSync, syncLog,
  staff: [{id, name, role, username, passwordHash, ...}],  // S1-S7
  scheduleDays: {date -> {type, manual, matches[]}},
  shifts: {date -> {staffId -> shiftKey}},
  shiftTypes: [{key, label, short, start, end, color, bg}],
  leave: [{id, staffId, start, end, reason, status, ...}],
  eventCategories: [{id, label, keywords[]}],
  content: [{id, type, date, title, status, staffId, ...}],
  notifications: [{id, type, msg, read, ts}],
  teams: {},          // 看点: teamKey -> {name, shortName, roster[], ...}
  matchups: {},       // 看点: 'a-vs-b' -> {history[], notes[]}
  highlights: []       // 看点: [{id, matchKey, tags, title, summary, status}]
}
```

## 持久化 (store.js)

| 函数 | 行 | 职责 |
|------|-----|------|
| App.save() | 147 | 保存state(磁盘localStorage / 云端Supabase双模式) |
| App.load() | 188 | 加载state(先云端后本地) |
| App.flush() | 251 | 防抖批量保存 |
| App.saveSession() | 124 | 本设备登录会话(sessionStorage) |
| sha256() | store.js:19 | Web Crypto API 密码哈希 |

## 撤销/重做 (store.js:304-380)

分区: roster / content / schedule / story
App._snap(section) / _restore(section, snap) / pushHistory / undo / redo / reset

## 云端同步 (main.js)

| 函数 | 行 | 职责 |
|------|-----|------|
| App.manualSync() | 173 | 手动同步按钮 |
| App._doAutoSync() | 218 | 自动轮询Supabase |
| App.startAutoSync() | 286 | 启动定时同步 |
| App.toggleAutoSync() | 307 | 开关自动同步 |

## 看点引擎 (story-engine.js)

| 函数 | 行 | 职责 |
|------|-----|------|
| App.storyData() | 18 | 惰性加载fetched-teams.json + state.teams深合并 |
| App.findTeamKey(str) | 69 | 5级匹配解析战队字符串 |
| App.storyH2H(a,b) | 120 | H2H交锋分析 |
| App.storyNexus(a,b) | 232 | 阵容恩怨检测 |
| App.storyGenerate() | 324 | 看点自动生成 |

## 后端 (server.js)

| 端点 | 职责 |
|------|------|
| GET /api/state | 读取state |
| PUT /api/state | 写入state |
| GET /api/fetch | 触发VLR赛程抓取 |
| GET /api/fetch-cache | 读赛程缓存JSON |
| POST /api/teams-fetch | 触发战队抓取(现抓现存) |
| GET /api/teams-cache | 读战队缓存JSON |
| scheduleDailyFetch() | server.js:343 每日6点定时抓取 |

## VLR 抓取 (vlr-scraper.js)

| 函数 | 行 | 职责 |
|------|-----|------|
| fetchVLRSchedule() | 导出 | 赛程抓取主入口 |
| parseVLRPage() | 98 | HTML解析赛程 |
| fetchVLRTeams() | 导出 | 战队抓取主入口(800ms限速) |
| parseTeamRoster() | 216 | 解析战队roster |
| parseTeamMatches() | 258 | 解析完赛记录 |

## CSS 结构 (style.css)

| 行范围 | 内容 |
|--------|------|
| 1-260 | 基础(变量/布局/导航/表格/按钮/弹窗) |
| 262-315 | 亮色主题覆盖 |
| 316-533 | 各功能模块样式(schedule/roster/content/staff/assign/mine) |
| 534-610 | 看点挖掘 st- 前缀 |
| 611-651 | 知识库 kb- 前缀 |

## 静态数据文件 (data/)

| 文件 | 内容 |
|------|------|
| fetched-schedule.json | VLR抓取的赛程(每日更新) |
| fetched-teams.json | VLR抓取的48队roster+战绩 |
| kb-content.json | 知识库12章节预渲染HTML(由scripts/build-kb-content.js生成) |
| vct-teams-seed.json | 50队种子注册表(含rosterSeed+formerTeams) |
| state.json | 本地开发用state(.gitignore) |

⚠️ 修改知识库内容: 直接改 data/kb-content.json (键=函数名, 值=HTML字符串)
⚠️ 修改战队种子数据: 直接改 data/vct-teams-seed.json (vct-teams.js 自动加载)
