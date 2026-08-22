# 图形工厂 规格文档 (Render Factory Spec)

> 目标：在中台内批量产出赛事运营图片，零 PS、纯 Canvas 渲染 + 底图 + 结构化变量。
> 适用版本：v20260823 起
> 配套文件：`ARCHITECTURE.md`（模块索引）

---

## 0. 设计约束（来自群主最终确认）

| 决策 | 取值 | 说明 |
|---|---|---|
| 图片尺寸 | **不限制** | 每个模板自带 `size: {w,h}`（取底图自然像素），不限定横竖版 |
| 品牌色 | **不约束** | 所有视觉装饰来自底图，引擎不参与配色 |
| 字体 | **管理员可约束** | 通过 `state.allowedFonts` 白名单；空名单 = 不限制 |
| 品牌来源 | **本项目无关 JEN/JEL/JENStudio 体系** | 不引用任何品牌色/字体文件 |
| 录入方式 | **全管理员手动（管理员素材后台）** | 队徽、coach、caster、头像由管理员在专属后台录入并同步；普通运营仅消费、不录入 |
| 语言 | **中英双语** | 每张产出图导出时**同时产出「中文版 + 英文版」两张 PNG**（同模板两个语言变体，见 4.0）；数据层 `nameCn / nameEn` 等成对字段支撑 |
| 时区 | **默认北京时间 (UTC+8)** | 所有 `scheduleDays[date]` 的 `date` / `time` 以北京时间存储与展示；休赛日 0 场时模板渲染空态兜底提示（见 7.6） |

---

## 1. 设计原则

1. **底图就是皮肤，模板只贴数据**：底图已包含品牌色、装饰、底部赛事角标；引擎不参与设计，只负责把 logo / 名字 / 头像 / 时间贴到正确坐标。
2. **模板 = JSON 数据**：新图种 = 新 JSON + 新数据适配器，引擎零改动。
3. **分组重复代替硬编码**：比赛块 / 解说块 / 选手块 / 教练块都按真实数据量动态布局。
4. **管理员显式管控关键资源**：字体、模板、素材后台的写操作均要求 `admin:true`；其中素材后台为独立后台，普通运营不可见录入入口。

---

## 2. 数据模型扩展

### 2.1 扩展 `state.teams`（叠在 vct-teams-seed.json 上）

```
state.teams[id] = {
  id, name, nameEn,         // nameEn 如 "Titan Esports Club"
  shortName, shortNameEn,   // nameEn 对应图 ③ 大标题
  logo,                     // Storage URL（管理员上传）
  roster: [{
    id,                     // 游戏 ID，如 "Dynamite"
    name,                   // 中文昵称（可空）
    avatar,                 // Storage URL
    number, height, formerTeams
  }, ... 5 项],
  coaches: [{                // 新字段，1~3 项
    id, name, role,          // role: 主教练/助理教练/战术教练
    avatar                  // Storage URL
  }]
}
```

### 2.2 新增 `state.casters[]`（解说池）

```
state.casters = [{
  id, name,                 // name 中文
  portrait,                 // Storage URL
  role,                     // 主解说 / 见习解说 / 嘉宾（作为文字展示，暂不以色块区分）
  createdBy, createdAt
}]
```

### 2.3 扩展 `scheduleDays[date].matches[i]`

```
matches[i] = {
  time, name, stage, bo,
    teams: 'AG vs TE',       // 兼容现有字符串
    teamAId, teamBId,       // 由 findTeamKey 解析后填入
    casterIds: [cid1, cid2] // 当日解说分配，引用 state.casters
}
// 注：`date` 一律为北京时间 (UTC+8) 的 `YYYY-MM-DD`；跨时区/深夜场以北京时间归日
```

### 2.4 新增 `state.templates[]`（模板库，管理员共享）

```
state.templates = [{
  id, name, version,
  orientation: 'portrait'|'landscape',
  size: { w, h },           // 设计坐标系（任意像素）
  exportScale: 1,           // 导出缩放系数（管理员自定义，见 3.6）
  base,                     // 底图 Storage URL
  slots: [...],             // 槽位列表（含分组规则）
  groups: {...},            // 分组布局规则
  createdBy, createdAt, updatedAt
}]
```

### 2.5 新增 `state.fonts[]` 与 `state.allowedFonts[]`（字体管理）

```
state.fonts = [{
  family, name,             // family = CSS font-family 值
  url,                      // Storage URL（woff2/ttf）
  scope: 'public'|'admin',
  uploadedBy, uploadedAt
}]
state.allowedFonts = ['Noto Sans SC', '...']  // 空数组 = 不限制
```

### 2.6 新增 `state.render`（会话级内存缓冲，不持久化到云端）

```
state.render = {
  currentTemplateId: null,
  currentSource: null,        // 当前数据源 {kind:'date'|'team', value}
  draftSlots: null,           // 管理员「模板结构编辑」中的未保存改动（admin 专属）
  overrides: {}               // 运营「导出前文字微调」覆盖 {[slotKey]: {text?,size?,color?,align?,font?}}
}
// 重启/刷新即清空；sessionStorage 可选兜底（不写云端）
```

---

## 3. 模板 Schema（核心）

### 3.1 顶层结构

```json
{
  "id": "preview-portrait-v1",
  "name": "今日预告(竖版)",
  "orientation": "portrait",
  "size": { "w": 1080, "h": 1620 },
  "exportScale": 1,
  "base": "https://...supabase.co/storage/v1/object/public/assets/templates/preview-portrait.png",
  "slots": [ /* 见 3.2 */ ],
  "groups": { /* 见 3.3 */ }
}
```

### 3.2 Slot 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `key` | string | 槽位唯一 ID |
| `type` | `'text'` \| `'image'` | 文本或图片 |
| `group` | `'static'` \| `'match'` \| `'caster'` \| `'player'` \| `'coach'` | 分组；`static` 单次出现，其它按数据量重复 |
| `index` | number | 组内下标（仅对重复组有意义） |
| `matchIndex` | number? | 嵌套组用（caster 挂在哪个 match 下） |
| `x, y` | number | 绝对坐标（static）或组内偏移（group） |
| `w, h` | number | 槽位尺寸 |
| `font` | string? | text 专用：CSS font-family |
| `weight` | number? | text 专用：100/400/700 |
| `size` | number? | text 专用：字号 px |
| `align` | `'left'\|'center'\|'right'` | text 专用 |
| `letterSpacing` | number? | text 专用：英文间距像素（图 ③ 副标题样式） |
| `color` | string? | text 专用：颜色（默认 #fff，可由底图反衬推断） |
| `shape` | `'rect'\|'circle'\|'arch'\|'rounded'` | image 专用 |
| `source` | string | 数据路径，如 `matches[0].teamA.shortName`；设为 `"literal"` 或 `null` 表示自由/固定内容（配合 `staticText`） |
| `editable` | boolean | 运营导出前可否微调（内容 + 字号/颜色/对齐/字体，见 3.7）；`false` 的槽位不开放编辑器 |
| `defaultValue` | string? | 兜底文案（数据缺失时显示） |
| `staticText` | string? | `source:"literal"` 时的固定/初始内容；管理员手填、运营导出前可改 |
| `createdBy` | `'system'`\|`'admin'` | 区分内置槽位与管理员自定义槽位（自定义可被删除/改结构） |

### 3.3 Groups 布局规则（**每模板独立，非全局配置**）

> ⚠️ `groups` 是**模板 JSON 内部字段**，每个模板自带一份。不同模板的 `match`/`caster` 方向可能完全不同（如「今日预告」match 垂直堆叠、「今日解说」match 水平左右分场），不可写成全局共享配置。下面的示例只是某张模板的取值，其他模板由管理员在编辑器里自由定义。

```json
// 示例 A：今日预告（match 垂直）
"groups": {
  "match":   { "repeatDirection": "vertical",   "repeatGap": 60, "maxCount": 3 },
  "caster":  { "matchIndex": "any", "repeatDirection": "horizontal", "repeatGap": 30, "maxCount": 4 },
  "player":  { "repeatDirection": "horizontal", "repeatGap": 24, "maxCount": 5 },
  "coach":   { "repeatDirection": "vertical",   "repeatGap": 32, "maxCount": 3 }
}

// 示例 B：今日解说（match 水平，caster 在每场下水平）
"groups": {
  "match":   { "repeatDirection": "horizontal", "repeatGap": 80, "maxCount": 2 },
  "caster":  { "matchIndex": "any", "repeatDirection": "horizontal", "repeatGap": 36, "maxCount": 3 }
}
```

引擎渲染时：
- 实际数据量 = `ctx.matches.length`、`ctx.matches[i].casters.length` 等
- `matchIndex: "any"` 表示该组对每个 match 实例重复布局
- 位置计算：`x = anchorX + i * (slotW + repeatGap)`（水平）或 `y = anchorY + i * (slotH + repeatGap)`（垂直）

### 3.4 管理员槽位增删（扩展点）

规范预置的 `slots` 只覆盖三张参考图的常见布局，**允许管理员在编辑器里增删自定义槽位**，无需改代码。这是模板可演进的核心扩展点。

**权限**：仅 `App.can('manage')` 可见「编辑模板结构」按钮（与字体/模板白名单同级的 admin 操作）。

**新增槽位流程**：
1. 选类型 `text` / `image`
2. 绑定来源：
   - 数据路径：从下拉选已有 `ctx` 路径（如 `matches[0].teamA.nameEn`）
   - 自由内容：选 `literal` → 填 `staticText`（管理员手填/运营导出前可改，`editable:true`）
   - 手动素材：image 类型可引用 `assets` 池中的某张图（path 形如 `asset:<id>`）
3. 在画布上拖放初始位置；表单微调 `x/y/w/h/字号/字体/颜色/对齐/遮罩/letterSpacing`
4. 选 group 归属：挂到已有重复组（`match`/`player`/`coach`/`caster`）则自动跟随复制布局；不挂则归 `static` 单次出现
5. 保存 → 模板 JSON 覆盖写回 `kv_store`（`createdBy:'admin'`）

**删除槽位**：选中自定义槽位（`createdBy==='admin'`）→ 确认删除；内置 `system` 槽位不可删（或需二次确认）。

**约束**：
- 自定义槽位的 `key` 自动生成（`custom_<timestamp>`）或管理员手填，需保证模板内唯一
- 数据路径合法性在保存时校验（路径在示例 `ctx` 上 `resolveSource` 试解析，失败则提示）
- 删除影响：若该槽位被某几张已存成品引用，仅影响后续重渲染，不回改历史成品（成品 PNG 已落地 Storage）

**自由文本槽位的渲染**：`source:'literal'` → 引擎取 `slot.staticText`（导出前运营手改的值优先于 `staticText`）；`source` 为 `undefined`/空字符串同视为 literal。

### 3.5 模板管理（管理员）

除槽位增删外，**管理员应能新建模板、重命名模板、删除模板、克隆模板**——模板本身也是可演进的运营资产，不应写死成 3 个。

**权限**：与字体/素材后台同级，仅 `App.can('manage')` 可见模板管理操作（新建/重命名/删除/克隆）；普通运营只能「选模板 + 出图」。

**① 新建模板（空白）**
- 管理员在图形工厂主 UI 点「新建模板」→ 弹窗填：
  - `name`（必填，可中文，如「今日预告(竖版)」「赛事海报 A」）
  - `orientation` / `size`（可先填顶底图自然像素，后续在编辑器调）
  - 上传 `base` 底图（走 `assets.js` 上传到 `assets/templates/`）
- 系统生成 `id`（`tpl_<timestamp>` 或手填，需全局唯一）、`createdBy:'admin'`、`createdAt`、空 `slots`/`groups`
- 进入编辑器后，管理员用 3.4 的槽位增删能力从零搭模板

**② 克隆模板**
- 在任一现有模板上点「克隆」→ 复制整份 JSON（换 `id`、清空 `createdAt/updatedAt`、`createdBy` 视操作者）→ 进入编辑器改名/改槽位
- 用途：基于「今日预告」快速派生「赛事海报 B」等变体，免去从零搭

**③ 重命名模板**
- 模板列表/编辑器内「重命名」→ 仅改 `name` 字段，不影响 `id`、不影响已用该模板导出的历史成品
- `name` 唯一性不强制（同名模板允许并存，`id` 才是主键），但 UI 提示重名

**④ 删除模板**
- 模板列表点「删除」→ 二次确认 → 从 `state.templates` 移除（同步 `kv_store`）
- 保护：若某模板 `id` 正被 `state.render.currentTemplateId` 引用或近期成品引用，提示影响范围但不阻断
- 预置 `system` 模板（3 张参考图默认壳）同样可删（管理员显式操作），删后不影响引擎

**持久化**：所有模板存 `state.templates[]`（经 Supabase 同步，管理员共享）；`data/render-templates.json` 仅作首次部署的**种子**，部署后运营新增/改名/删除的模板以 `state.templates` 为准（种子不覆盖线上改动，参见既有 `data/fetched-teams.json` 不进 state 的反模式，此处反向使用——模板是运营资产，应进 state 并同步）。

---

### 3.6 导出分辨率（管理员自定义）

模板的 `size` 是**设计坐标系**（所有槽位坐标、字号、间距的基准空间），导出的成品分辨率 = 设计坐标 × **缩放系数 `scale`**。管理员应能自定义这个缩放系数，从而控制成品清晰度，而不必重建模板。

**两层自定义入口（均为 admin 操作）**：

1. **模板级默认 `exportScale`**（在模板设置里填，落 `tpl.exportScale`，默认 `1`）
   - 管理员建/改模板时设定，如填 `2` 表示默认导出 2 倍图（社交媒体高清）
   - 普通运营无此入口，导出时直接用模板默认值
2. **导出时临时覆盖**（图形工厂主 UI 导出面板，admin 可见）
   - 下拉：1x / 2x / 3x / 自定义
   - 选「自定义」→ 管理员填目标宽（高按比例由引擎反算 `scale = targetW / size.w`），或填任意 `scale` 小数（如 `1.5`）

**引擎实现**（`renderTemplate(tpl, ctx, opts)`，`opts.scale`）：
- 最终画布尺寸 = `size.w * scale` × `size.h * scale`
- 绘制前 `ctx.scale(scale, scale)`，**所有设计坐标/字号/间距按原值传入即自动等比放大**——遮罩半径、字距、圆角也随之放大，零额外换算
- `renderToBlob` 输出即最终分辨率 PNG（如 1080×1620 设计 ×2 → 2160×3240）

**约束**：
- `scale` 下限 `0.1`、上限 `10`（防内存爆炸；>4 时 UI 提示"高分辨率可能耗时"）
- 同一模板不同 `scale` 导出为不同分辨率文件，互不影响；历史成品按当时 `scale` 落地，不受后续改默认值影响
- 预览画布为性能考虑固定按 1x 渲染（或 ≤2x 抽帧），仅最终导出应用 `scale`——避免在编辑器里拖拽时卡顿

**与 `size` 的关系澄清**：`size` 是"画布多大/坐标空间"，`scale` 是"导出时放大几倍"。两者解耦后，管理员可在不改任何槽位坐标的前提下，把同一张预告图导出成朋友圈小图（1x）和公众号大图（3x）。

### 3.7 导出时文字编辑（运营）

`editable:true` 的文字槽位，除手改**内容**外，运营在导出前还应能调整**字号**（及颜色、对齐、字体族），以适配不同底图/文案长度。这是运营级的「微调」，与 3.4 管理员改「模板结构」是两层不同能力。

**编辑入口**：运营点选画布上的 editable 文字槽位 → 弹出轻量文字编辑器：
- 内容文本框（覆盖 `slot.staticText` / 数据生成值）
- **字号** number / 滑块（基准为模板设计坐标系 px，导出时随 `scale` 自动放大，见 3.6）
- 颜色（可选，默认沿用模板 `color`）
- 对齐（可选，默认沿用模板 `align`）
- 字体族（从白名单 `state.allowedFonts` 选；白名单空则全列）

**存储（会话级覆盖，不写回模板）**：

```
state.render.overrides = {
  [slotKey]: { text?, size?, color?, align?, font? }   // 仅存被改字段
}
```

- 渲染引擎在 `renderSlot` 时优先用 `overrides[slotKey]` 覆盖 `slot` 对应字段，再绘制
- `draftSlots`（2.6）专用于**管理员模板结构编辑**的未保存改动；`overrides` 专用于**运营导出前文字微调**——两者互不污染
- 刷新页面 / 关页：`overrides` 随 `state.render` 清空（同既有约定，可加 sessionStorage 兜底但不上传云端）

**权限边界**：
- 运营只能改 `editable:true` 的槽位；`editable:false`（如队名、比分，来自数据不希望被改）不开放编辑器
- 字号调整**不**受字体白名单约束（白名单只管「能用哪些字体」，字号自由）
- 管理员拥有 3.4（结构级，含改默认字号）+ 此处（同运营界面）双重能力

**超框处理**（与 3.4 表单共用）：`measureText` 测量编辑后实际宽度，超出槽位 `w` 时先告警，v2 支持「自动缩字号」兜底。

---

### 3.8 编辑器辅助能力（参考线对齐 + 历史）

图形工厂编辑器的拖拽体验直接决定管理员"从零搭模板"和运营"微调"两件事的效率，需补齐两类辅助。

#### 3.8.1 参考线对齐（管理员搭模板省时）

由于每个赛事的模板布局都会变化、无法预填坐标（见 1/3.5），管理员每次都要从空壳拖出 20+ 槽位。为此编辑器提供**对齐辅助**，降低定位成本：

- **智能参考线（Smart Guides）**：拖拽某槽位时，实时与画布内其他槽位/底图关键元素比对，出现对齐参考线（左/右/中/顶/底/基线对齐），吸附到 ±2px 内自动对齐。
- **网格吸附（Grid Snap）**：可开关的网格（默认 10px），槽位坐标自动吸附到网格交点。
- **等距复制**：拖动时按住修饰键复制上一槽位的间距（如 5 个选手等距排布，复制首末间距自动均分）。
- **标尺 + 安全边距**：画布四周显示标尺，可设安全边距参考线（防内容贴边被平台裁切）。

这些辅助**只影响编辑器交互，不写入模板**（模板存的仍是最终绝对坐标）。

#### 3.8.2 历史：撤销/重做/恢复默认/清空（与现有功能块对齐）

编辑器复用 App 既有的 `_snap` / `_restore` 历史分区机制（与 roster/content/schedule/story 同套），新增 `render` 分区。每次结构性改动（增删槽位、改坐标/字号）与每次运营微调（3.7 `overrides`）都入栈快照，最多 50 步。

| 操作 | 作用域 | 说明 |
|---|---|---|
| **撤销 / 重做** | 当前编辑会话 | 在时间线上回退/前进任意一步（含槽位增删、坐标、文字微调） |
| **恢复默认** | 单个槽位 / 整模板 | 把当前槽位（或整模板）回到「模板原始默认值」——运营微调的 `overrides` 与误改的结构一并清掉，回到 `tpl.slots` 定义态 |
| **清空** | 当前会话 | 清空 `state.render`（含 `draftSlots` 未保存结构改动 + `overrides` 文字微调），回到刚打开模板时的干净态（不落盘，需显式保存才影响模板） |

> 与既有一致：撤销/重做针对「当前未保存的编辑动作」，恢复默认/清空针对「回退到模板定义态」。三者均不立即写 `kv_store`，需用户点「保存模板」才持久化——这与其它功能块的保存模型一致。

---

## 4. 三张图的槽位设计

### 4.0 双语策略：每张图导出「中文版 + 英文版」两张 PNG

按约束（中英双语），**单个模板的一次导出同时产出两个语言变体**，而非单语混排：

- **中文版**：`meta.title`/`meta.date` 等用中文；队伍 `name`/`shortName`、选手 `id`、解说 `name` 用中文态（`nameCn` 或现有 `name`）。
- **英文版**：同源数据切到 `nameEn`/`shortNameEn`/`id`（游戏 ID 本身即英文）等英文字段；`meta.subtitle` 用英文（如 "TOURNAMENT PREVIEW"）。
- **实现**：`buildCtx(date, lang)` 第二参数切语言态，引擎零改动；`batchRender` 对同一数据源渲染 `zh` + `en` 两次。
- **批量计数翻倍**：一天 N 张图 × 2 语言变体，最终产出 2N 张 PNG（见 5.1 命名与 zip）。
- **命名规则**：`{模板名}_{数据源}_{语言}_{日期}.png`，例如：
  - `今日预告_2026-08-23_zh_20260823.png`
  - `今日预告_2026-08-23_en_20260823.png`
  - `今日首发_EDG_2026-08-23_zh_20260823.png`

> 若某模板仅需单语（如纯英文定妆照），模板可标注 `lang: ['en']` 关闭另一变体；默认 `lang: ['zh','en']`。

### 4.1 今日预告（竖版，参考图 ①）

| 槽位 key | group | type | source | editable |
|---|---|---|---|---|
| `title` | static | text | `meta.title`（"赛事预告"） | ✓ |
| `subtitle` | static | text | `meta.subtitle`（"TOURNAMENT PREVIEW"） | ✓ |
| `date` | static | text | `meta.date`（"8月21日"） | ✓ |
| `weekday` | static | text | `meta.weekday`（"星期五"） | ✓ |
| `matchA_logo` | match[i] | image | `matches[i].teamA.logo` | — |
| `matchA_name` | match[i] | text | `matches[i].teamA.shortName` | ✓ |
| `matchB_logo` | match[i] | image | `matches[i].teamB.logo` | — |
| `matchB_name` | match[i] | text | `matches[i].teamB.shortName` | ✓ |
| `match_vs` | match[i] | text | "VS" | — |
| `match_time` | match[i] | text | `matches[i].time` | ✓ |

组：`match` 垂直重复，gap 60px，maxCount 3。

### 4.2 今日解说（横版，参考图 ②）

| 槽位 key | group | type | source | editable |
|---|---|---|---|---|
| `title` | static | text | `meta.title`（"今日解说"） | ✓ |
| `subtitle` | static | text | `meta.subtitle`（"TODAY'S CASTERS"） | ✓ |
| `matchA_logo` / `matchB_logo` / `match_time` | match[i] | image/text | 同 4.1 | ✓ |
| `caster_portrait` | caster[i,j] | image | `matches[i].casters[j].portrait` | — |
| `caster_name` | caster[i,j] | text | `matches[i].casters[j].name` | ✓ |
| `caster_role` | caster[i,j] | text | `matches[i].casters[j].role`（"见习解说"） | ✓ |

组：`match` 水平（左右分两场），`caster` 在每 match 内水平重复 2~3 人。

### 4.3 今日首发（横版，参考图 ③）

| 槽位 key | group | type | source | editable |
|---|---|---|---|---|
| `main_title` | static | text | `team.nameEn`（"TITAI ESPORTS CLUB"） | ✓ |
| `sub_title` | static | text | `team.nameEn`（同源，字号小 + 大间距） | ✓ |
| `team_logo` | static | image | `team.logo` | — |
| `player_portrait` | player[i] | image | `team.roster[i].avatar` | — |
| `player_id` | player[i] | text | `team.roster[i].id` | ✓ |
| `player_label` | static | text | "PLAYER" | — |
| `coach_portrait` | coach[i] | image | `team.coaches[i].avatar` | — |
| `coach_name` | coach[i] | text | `team.coaches[i].name` | ✓ |
| `coach_role` | coach[i] | text | `team.coaches[i].role` | ✓ |
| `coach_label` | static | text | "COACH" | — |

组：`player` 水平 5 人（与图 ③ PLAYER 区块一致），`coach` 垂直 1~3 人（COACH 区块）。

---

## 5. 渲染引擎 `js/render-engine.js`

### 5.1 函数签名

```js
loadImage(url) → Promise<HTMLImageElement>      // crossOrigin='anonymous'
registerMask(name, fn)                          // 扩展点：注册新遮罩
maskImage(ctx, shape, x, y, w, h)               // 应用遮罩
resolveSource(path, ctx) → any                  // 通用路径解析 'matches[0].teamA.shortName'
renderSlot(slot, ctx, absX, absY, override?) → Promise<void>  // override: state.render.overrides[slotKey]（3.7），优先覆盖 slot 字段
renderTemplate(tpl, ctx, opts) → Promise<HTMLCanvasElement>   // opts: { scale?: number, lang?: 'zh'|'en' } 见 3.6 / 4.0
renderToBlob(canvas) → Promise<Blob>            // image/png
buildCtx(source, lang) → object                // 同数据源切中/英文态（4.0）
batchRender(tpl, ctxs, onProgress) → Promise<{blob, name}[]>  // 分片渲染，返回带命名元信息的 Blob 列表（按 4.0 命名规则）
exportZip(items: {blob, name}[], zipName) → Promise<Blob>      // 引 JSZip 打包多张（需 `lang:['zh','en']` 时自动翻倍）
```

### 5.2 resolveSource 路径语法

- `meta.date` → `ctx.meta.date`
- `matches[0].teamA.shortName` → `ctx.matches[0].teamA.shortName`
- `matches[0].casters[1].name` → `ctx.matches[0].casters[1].name`
- `team.roster[3].id` → `ctx.team.roster[3].id`

解析失败（undefined / null）→ 文本槽显示 `defaultValue` 或空占位；图片槽显示**首字占位灰块**（仅作示意）。

**缺素材拦截（关键，统一规则，消除此前矛盾）**：当任一**图片槽**缺 URL（队徽/头像/教练/解说定妆照未录入）时：
1. 预览画布顶部显示**红色横幅**「缺失素材：XX队的 logo / YY 选手头像…」，列出具体缺失项；
2. **导出按钮禁用**（或二次强确认后才允许导出残图）；
3. 灰块仅作占位示意，**不允许静默导出残图对外发布**（修正此前"灰块且不报错"的写法）。

> 文本类缺值（如 `nameEn` 为空）仅降级为空串 + 告警提示，不阻断导出（文字可手补）。

### 5.3 分组布局算法

```js
function layoutGroup(tpl, ctx, groupName, ctxArr) {
  const group = tpl.groups[groupName];
  const actual = ctxArr.length;          // 实际数据量
  return ctxArr.map((item, i) => {
    const offset = i * (group.slotH + group.repeatGap);
    return { index: i, dx: 0, dy: offset };  // 水平/垂直选其一
  });
}
```

### 5.4 遮罩注册表（可扩展）

```js
App.MASKS = {
  rect:    (ctx, x, y, w, h) => {},
  circle:  (ctx, x, y, w, h) => { ctx.arc(x+w/2, y+h/2, w/2, 0, Math.PI*2); ctx.clip(); },
  arch:    (ctx, x, y, w, h) => { /* 上半圆 + 下方矩形 */ },
  rounded: (ctx, x, y, w, h) => { /* 圆角矩形 */ }
};
// 扩展：App.MASKS.hexagon = (ctx, x, y, w, h) => { ... }
```

### 5.5 渲染前置检查

1. `await document.fonts.load(...)` 等所有引用字体 ready
2. 跨域：所有图片用 Storage 公开 URL + `crossOrigin='anonymous'`
3. 文字超框：measureText 测量，超宽告警或自动缩字号（先告警，缩字号为 v2）

---

## 6. 字体管理 `js/font-manager.js`

### 6.1 三条字体来源

1. **预载**：index.html 注入 Noto Sans SC 多字重（中文必需）
2. **Storage 注册**：管理员上传到 `assets/fonts/`，引擎生成 `@font-face` 注入 `<head>`
3. **本地会话上传**：FontFace API 即时生效，仅本次会话

### 6.2 管理员约束机制

- `state.allowedFonts = ['Noto Sans SC', 'J_ESports']`：非空时，编辑器下拉框只列白名单
- 空数组：不限制
- 本地上传：本会话可见但不进白名单，下次重开失效
- **白名单健壮性**：渲染前 `ensureFont` 校验白名单中的字体是否已在页面注册（@font-face 可用 / 本地已加载）。若管理员删了 Storage 上的字体文件但白名单仍列着，`ensureFont` 失败 → 该槽位**回退到默认字体并预览横幅告警**（不静默失败、不崩溃），提示管理员去白名单清理。

### 6.3 函数签名

```js
registerFont(family, url) → Promise<void>      // 注入 @font-face
loadLocalFont(file) → Promise<string>          // 返回 family 名
ensureFont(family, weight, size) → Promise<void> // 渲染前等待字体 ready
getAllowedFonts() → string[]                    // 白名单过滤后的下拉数据
```

---

## 7. 管理员素材后台 `js/view-assets.js`（admin:true）

### 7.0 权限模型与职责边界

- **独立后台，仅管理员可见**：NAV 项 `{ key:'assets', label:'素材管理', ico:'🗂️', admin:true }`；路由层 `App.renderView()` 对 `assets` 加 admin 守卫（复用现有 `admin:true` 权限位机制，与图形工厂 `render` 同源）。
- **为何是管理员专属**：队徽、选手/教练头像、解说定妆照是对外发布的权威品牌资产，录入质量直接决定三张产出图的观感。普通运营只在使用图形工厂时**消费**这些素材，不负责**定义**。
- **数据写入与同步**：所有录入落 `state`（teams / coaches / roster.avatar / casters / fonts），经 Supabase 同步全员。管理员录入一次，所有操作员立即可见可用。
- **与图形工厂主 UI 的职责切分**：
  - 后台管「**素材池的定义**」——这个队 logo 长什么样、5 个选手是谁、3 个解说是谁。
  - 主 UI 管「**单次出图的组装**」——今天用哪场、某场挂哪几个解说（从池里选）、文字手改、导出。

### 7.1 后台功能分区

```
素材管理（管理员后台）
├── ① 队伍素材
│   ├── 队徽上传              → state.teams[id].logo
│   ├── 选手信息（增删改）    → state.teams[id].roster[]  {id(游戏ID), name, avatar, number, ...}
│   │      （解决静态种子过期：vct-teams-seed.json 为只读底稿，管理员可经 UI 改选手游戏ID/昵称/头像，
│   │        覆盖写进 state.teams[id].roster，经 Supabase 同步全员，首发图不再显示旧 ID）
│   └── 教练管理（增删改）    → state.teams[id].coaches[]  {id, name, role, avatar}
├── ② 解说素材
│   ├── 解说池（增删改）  → state.casters[]  {id, name, portrait, role, createdBy, createdAt}
│   └── 角色维护：主解说 / 见习解说 / 嘉宾（仅作文字标注，不以色块区分）
└── ③ 字体素材
    ├── 本地上传（仅本次会话，FontFace API）
    └── 上传 Storage + 加入白名单（仅管理员）→ state.fonts[] / state.allowedFonts[]
```

### 7.2 录入流程（标注落点）

| 录入项 | 操作路径 | 落点（state） | 同步 |
|---|---|---|---|
| 队徽 | 选队 → 选文件 → 校验 → 上传 Storage → 回填 URL | `teams[id].logo` | Supabase 即时 |
| 选手信息 | 选队 → 选/增 roster 项 → 编辑游戏ID/昵称/上传头像 | `teams[id].roster[i]`（覆盖静态种子） | 同上 |
| 教练 | 选队 → 新增记录（姓名+角色+头像） | `teams[id].coaches[]` | 同上 |
| 解说 | 解说池 → 新增（姓名+角色+定妆照） | `casters[]` | 同上 |
| 字体 | 上传 → 注册 @font-face →（管理员）入白名单 | `fonts[]` / `allowedFonts[]` | 同上 |

### 7.3 录入校验

- 图片：限类型 png/jpg/webp、单文件 ≤ 5MB；队徽/头像建议 1:1，比例不符前端提示但不强制。
- 必填：队徽、选手头像、教练头像、解说定妆照均为产出图必填；缺失时图形工厂预览给出「缺素材」告警，而非静默空白。
- 防重复：同队重复上传 logo 覆盖旧值（不新增记录）。
- 删除：教练/解说支持删除；若正被模板引用，提示影响范围（不阻断）。

### 7.4 不属后台职责，但需在主 UI 明确设计

以下动作是**运营每日必做**，规格此前未给出 UI，现补明确：

#### 7.4.1 当日解说分配（运营排期动作）

- **入口**：图形工厂主 UI → 选「今日解说」模板 → 选日期 → 自动带出当日所有比赛 → 每张比赛卡片下列出 `casters[]` 池，勾选 1~3 名解说（写 `scheduleDays[date].matches[i].casterIds`）。
- **交互**：比赛卡片横向排列，每场一个「+ 添加解说」下拉（搜索/勾选），已选解说显示头像+名字+角色文字；可改顺序、移除。
- **归属**：属运营排期，落 `state`（同步全员），非后台录入。
- **缺分配告警**：若某场未分配解说，预览时该场 `caster_portrait`/`caster_name` 缺值，触发 5.2 缺素材横幅。

#### 7.4.2 赛程数据本身

matches 由 VLR 抓取 / 手动补录（既有 story 能力），素材后台不碰。

### 7.5 路由守卫实现（复用现有机制，无需新写权限逻辑）

**现有权限判据**（store.js:285）：`App.can('manage')` → `me.role === 'admin'`。

**导航与分发已内置 admin 守卫**：
- 导航栏渲染：`NAV.filter(n => !n.admin || App.can('manage'))`（main.js:342）——非 admin 项全显示，admin 项仅管理员显示
- 导航跳转：`if(item && item.admin && !App.can('manage')) key = 'mine'`（main.js:404）——非管理员跳 admin 项自动回退到「我的」

素材后台只需接入同一套，改 4 个接入点：

**① NAV 数组（main.js:321）新增一项**
```js
{ key:'assets', label:'素材管理', ico:'🗂️', admin:true },
```

**② 视图分发（main.js:419 App.renderView）新增分支**
```js
else if(App.currentView === 'assets') v.innerHTML = App.renderAssets();
```

**③ 录入动作防御（view-assets.js 各写操作 handler 顶部）**
```js
App.assetSave = function(){
  if(!App.can('manage')){ App.toast('仅管理员可录入素材','err'); return; }
  // … 落 state.teams[id].logo / coaches / casters / fonts
};
```
（参考既有 `const isAdmin = App.can('manage')` 模式，story/view 同款）

**④ 渲染时按权限显隐录入控件**
```js
// App.renderAssets() 内
const isAdmin = App.can('manage');
// … 录入表单 / 上传按钮仅在 isAdmin 时输出 onclick
```

**防护边界说明（重要）**
- 这是「页面级 / 动作级」守卫，**不是数据级鉴权**。纯前端无后端鉴权，真正的写权限由 Supabase `anon` 信任模型兜底（anon key 团队内共享，所有人可写）。
- 素材后台的 admin 守卫解决「普通运营误入 / 误操作」，与项目既有所有 admin 模块（dash/roster/staff/assign）防护水位一致。
- 若需真正数据级隔离，需引入 Supabase Auth（当前未启用，见 cloud.js 现状）。

---

### 7.6 图形工厂主 UI 每日工作流（运营）

把 7.4 的分配能力与三张图串成可操作的日常流：

#### 7.6.1 今日预告（竖版）
1. 选「今日预告」模板 → 选日期（北京时间）→ 自动带出当日 1~3 场（`teams:'AG vs TE'` 经 `findTeamKey` 解析）。
2. 预览（引擎按 3.3 `match` 垂直分组布局）。
3. 对 `editable` 文字微调（3.7）+ 撤销/恢复（3.8.2）。
4. 导出 → 自动产「中文版 + 英文版」两张 PNG，命名见 4.0，或直接打 zip。

#### 7.6.2 今日解说（横版）
1. 选「今日解说」模板 → 选日期 → **进入 7.4.1 解说分配**（给每场挂 1~3 解说）。
2. 预览（match 水平分场 + caster 子组）。
3. 微调 + 导出（双语双图 / zip）。

#### 7.6.3 今日首发（横版，批量）
1. 选「今日首发」模板 → 选日期 → **自动带出当日所有上场队伍**（按 `matches` 涉及的 `teamAId/teamBId` 去重）。
2. 列表勾选要出的队伍（默认全选当日队伍）→ **一键批量出图**：对每个队伍 `buildCtx(teamId, lang)` 渲染 `zh`+`en`。
3. 预览可逐队查看；微调仅作用于当前查看的队伍会话（不互相污染）。
4. 导出 → 每队中英双图，整体打 **一个 zip**（按 4.0 命名规则，如 `今日首发_EDG_zh_...png` / `_en_...png`）。
   - 一日 6 支队 → zip 内 12 张图，运营无需逐张下载改名。

> 休赛日兜底：选日期后 0 场 → 预览显「当日无赛程」空态提示，不渲染残图。

---

## 8. 前端模块清单

| 操作 | 文件 | 状态 | 备注 |
|---|---|---|---|
| 新增 | `js/assets.js` | — | Storage REST 封装（upload/list/getPublicUrl），沿用 CLOUD._headers |
| 新增 | `js/font-manager.js` | — | 字体注册/白名单/本地加载 |
| 新增 | `js/render-engine.js` | — | Canvas 纯函数，含 resolveSource + 分组布局 + 遮罩注册表 |
| 新增 | `js/view-assets.js` | — | **管理员素材后台** UI（队伍素材含**选手信息增删改** / 解说素材 / 字体素材，admin:true） |
| 新增 | `js/view-render.js` | — | 图形工厂主 UI：模板选择 + **模板管理（3.5）** + 数据源 + 混合编辑器（拖块+表单）+ **参考线对齐（3.8.1）** + 历史（撤销/重做/恢复默认/清空，3.8.2）+ **当日解说分配 UI（7.4.1）** + **按日期批量出首发（7.6.3）** + 字体选择 + 导出（**中英双图 / zip，4.0·5.1**）+ **管理员槽位增删（3.4）** |
| 新增 | `data/render-templates.json` | — | 3 个默认模板种子壳（首次部署用；正式模板存 `state.templates` 并同步，种子不覆盖线上改动） |
| 改 | `js/store.js` | seedState | 加 `templates/casters/fonts/allowedFonts/render` 字段 |
| 改 | `js/main.js` | NAV + 路由 | 加 `assets`(管理员素材后台, admin:true) + `render`(图形工厂, 运营可用；模板/字体管理按钮按 `App.can('manage')` 条件渲染) |
| 改 | `js/view-roster.js` | 可选 | 队伍管理页加「补 logo / 上传头像」入口（也可只在素材库做） |
| 改 | `js/story-engine.js` | findTeamKey | 已存在，复用以解析 matches[i].teamAId |
| 改 | `index.html` | — | 引 5 个新 JS + Noto Sans SC `@font-face` + 版本号 |
| 改 | `css/style.css` | — | 新增 `rf-`(render) 和 `al-`(assets) 两个 CSS 区块 |
| 改 | `supabase-setup.sql` | 追加 | 建 `assets` bucket + RLS（public read / anon write） |

---

## 9. 扩展点（为后续功能预留）

1. **新图种**：写一个新 JSON 模板 + 一个 `buildCtx` 适配器，引擎零改动
2. **新遮罩形状**：`App.MASKS.hexagon = ...` 一行注册
3. **新数据字段**：任意加到 state.teams / state.casters，通过 source 路径引用
4. **新语言**：`nameCn / nameEn` 扩成 `nameLocale[zh|en|ja|...]`，path 不变
5. **新导出格式**：renderToBlob 后跟不同编码器（webp/jpeg）
6. **服务端渲染**：render-engine 是纯函数，未来可移植到 Node（处理批量分发）

---

## 10. 手动操作清单（PAT 推不动，需网页执行）

1. Supabase 控制台 → 创建 `assets` bucket
2. bucket 内手动建目录：`templates/` `logos/` `portraits/` `coaches/` `casters/` `fonts/` `outputs/`
3. RLS：SELECT 公开，INSERT/UPDATE/DELETE 允许 anon（与 kv_store 信任模型一致）
4. 工作流文件 `.github/workflows/scrape-vlr.yml` 已包含 teams 抓取（之前已加），无需再加图像抓取

---

## 11. 落地顺序

```
Step 1  管理员素材后台 + 数据补全（依赖最少，管理员先录数据）
        ├── js/assets.js
        ├── js/font-manager.js
        └── js/view-assets.js

Step 2  渲染引擎（可单测，与 UI 解耦）
        └── js/render-engine.js（含遮罩注册表）

Step 3  图形工厂 UI
        ├── js/view-render.js（混合编辑器 + 3 个默认模板壳）
        └── data/render-templates.json

Step 4  导航 + 状态接入
        ├── js/main.js NAV/route
        ├── js/store.js seedState
        ├── index.html 脚本与字体
        └── css/style.css rf-/al- 样式

Step 5  手动操作
        ├── Supabase 建 assets bucket + RLS
        └── 运营首次录入：队徽/头像/教练/解说

Step 6  测试与部署（与之前 story 模块同流程）
```

---

## 附录 A：DoD 验收标准

1. 选模板 → 选数据源 → 预览 → 一键导出 N 张 PNG，全程零 PS
2. 中英双语槽位渲染正确，无字体缺失/乱码
3. 比赛 1/2/3 场、解说 2~3 人、选手 5 人、教练 1~3 人等变数量场景均自动布局
4. 底图加载完成、字体 ready 后再渲染，不出现跨域污染
5. 字体白名单约束生效：非白名单字体不可在编辑器下拉
6. 管理员手动录入的 logo / 头像 / 解说全部走素材后台，可任意修改；非管理员不可见录入入口
7. 编辑会话内（state.render）操作可任意重导出；会话外（刷新）按需从模板+数据源重新生成
8. 管理员可在编辑器新增/删除自定义槽位（含自由文本、手动素材引用），保存后模板持久化；非管理员无此入口
9. 管理员自定义槽位不影响内置 `system` 槽位；删除自定义槽位不影响已落地的历史成品 PNG
10. 管理员可新建/克隆/重命名/删除模板（命名中文可），持久化进 `state.templates` 全员同步；非管理员仅能选用不能管理
11. 删除/重命名模板不影响已用其导出的历史成品 PNG（`id` 为主键）；克隆模板生成独立 `id` 互不影响
12. 管理员可自定义导出分辨率（模板级 `exportScale` 默认 + 导出时 1x/2x/3x/自定义覆盖），成品像素随之变化；预览按 1x 不卡顿
13. 运营可在导出前对 `editable` 文字槽位微调字号/颜色/对齐/字体（3.7），覆盖仅存 `state.render.overrides` 不写回模板；`editable:false` 槽位不开放编辑器；字号随 `scale` 自动放大
14. **参考线对齐**生效：拖拽槽位出现智能参考线/网格吸附，管理员从空壳搭模板效率可接受（3.8.1）
15. **编辑器历史**可用：撤销/重做跨结构改动与文字微调；「恢复默认」回退到模板定义态；「清空」回到干净态；三者均经 `App._history['render']` 分区、不误触其它功能块（3.8.2）
16. **当日解说分配 UI**可用：选日期后逐场勾选 1~3 解说，落 `scheduleDays[date].matches[i].casterIds` 并同步（7.4.1）
17. **按日期批量出首发**可用：选日期自动带出当日所有队伍，勾选后一键批量渲染，整体打 zip（7.6.3）
18. **缺素材拦截**生效：任一图片槽缺 URL 时预览红色横幅 + 导出禁用/强确认，不静默导出残图（5.2）
19. **双语双图**生效：单模板一次导出产出中文版 + 英文版两张 PNG（按 4.0 命名），批量时计数正确翻倍
20. **导出 zip + 自动命名**生效：多张图一键打 zip，文件名按 `{模板名}_{数据源}_{语言}_{日期}.png` 规则（5.1 / 4.0）
21. **管理员可编辑队伍名单**生效：经素材后台改选手游戏 ID/昵称/头像覆盖静态种子，首发图不再显示过期 ID（7.1）
22. **时区默认北京时间**生效：`scheduleDays[date]` 以 UTC+8 归日，休赛日 0 场显空态兜底（约束表 / 7.6）
23. **解说角色不色块区分**：`caster_role` 仅作文字展示（7.1 / 4.2）；**groups 每模板独立**：不同模板 match/caster 方向可不同，非全局配置（3.3）