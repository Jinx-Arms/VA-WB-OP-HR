# STORY.md — 瓦电赛事运营中台 功能介绍 PPT

## ① 用户意图对齐

- **目标受众**：团队内部（运营组 / 管理层 / 新成员），作为中台的能力说明与建设复盘。
- **核心目标**：让观众清楚中台「现在能做什么」「怎么搭起来的」「踩过什么坑」「下一步往哪走」，建立对工具的信任与扩展预期。
- **PPT 长度**：约 16 页（含封面、目录、3 个章节扉页、结束页）。Hero 页配额 4 页（封面、能力总览、经验教训高潮、结束页），占 25%。
- **视觉调性**：科技电竞 / 暗色冷峻 / 数据驱动 / 克制专业（Valorant 红蓝调性）。
- **内容边界**：
  - 必讲：核心功能模块、技术架构、开发经验教训、未来扩展方向（私有云部署、AI 文案多样化）。
  - 不讲：具体账号密码、代码逐行、第三方敏感信息。
  - 禁碰：政治相关、未核实数据。

## ② 页面布局骨架

**章节划分（4 章 + 封面/目录/结束）**：
- 封面（01）
- 目录（02）
- 第一章「中台概览」扉页（03）→ 内容页：04 中台是什么 / 05 技术架构
- 第二章「核心功能」扉页（06）→ 内容页：07 功能总览 / 08 赛程与排班 / 09 战队库与看点挖掘 / 10 图形工厂 / 11 赛况战报
- 第三章「开发经验教训」扉页（12）→ 内容页：13 三大教训 / 14 数据分层与诚实修正
- 第四章「未来扩展」扉页（15）→ 内容页：16 私有云与 AI 文案 / 17 扩展路线图
- 结束页（18）

**目录↔章节扉页契约**：目录声明 4 章，对应扉页 03/06/12/15 共 4 张，编号连续、标题与页码区间一致。

**Hero 页定位**：01 封面、07 功能总览（能力数据冲击）、14 数据分层高潮、18 结束页。任意两个 Hero 间隔 ≥ 1 个 Supporting 页。

**rhythm 曲线**：01 peak / 02 transition / 03 transition / 04 valley / 05 valley / 06 transition / 07 peak / 08 valley / 09 valley / 10 valley / 11 valley / 12 transition / 13 valley / 14 peak / 15 transition / 16 valley / 17 valley / 18 peak。

**非对称版式预算**：≥ 40% 页面用非对称（04/05/08/09/10/11/13/14/16/17 等），对称版式（02 目录、07 功能总览卡、18 结束）控制在 ≤ 2-3 页。

## ③ 页面大纲

| # | title | type | role | rhythm | layout | visual | visual_role | density | anti_pattern | description |
| :- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 01 | 瓦电赛事运营中台 | cover | hero | peak | 全幅渐变+骑线大标题 | L1 暗色电竞氛围底 | atmosphere | 30字/1图/35% | 禁止装饰小图塞标题栏 | 封面：主标题+副标"功能介绍 · 建设复盘 · 扩展方向"+版本号 v=20260823e |
| 02 | 目录 | catalog | supporting | transition | 左标题+右内容 | L3 角标 | — | 120字/0图/25% | 禁止四卡片预览 | 四大章：概览/功能/教训/未来，每项一句话 |
| 03 | 第一章 中台概览 | section | transition | transition | 全屏章节大字 | L1 渐变背景 | atmosphere | 30字/1图/40% | 禁止铺满正文 | 章节编号01 + 标题 + 一句引导 |
| 04 | 中台是什么 | content | supporting | valley | 左标题+右内容 | Diagram(定位图) | evidence | 220字/1图/25% | 禁止等宽卡片横排 | 定义：纯前端 SPA + Supabase 的 VCT CN 运营中台，服务赛程/阵容/内容/图形全流程 |
| 05 | 技术架构 | content | supporting | valley | 非对称双栏 | Diagram(架构分层) | evidence | 240字/1图/22% | 禁止50:50等分 | 前端 SPA / 静态托管 GitHub Pages / 云端 Supabase / VLR 零依赖抓取 / GitHub Actions 定时 |
| 06 | 第二章 核心功能 | section | transition | transition | 全屏章节大字 | L1 渐变背景 | atmosphere | 30字/1图/40% | 禁止铺满正文 | 章节编号02 + 标题 |
| 07 | 功能总览 | content | hero | peak | 巨型数字+洞察 | 大数字 9 模块 | anchor | 180字/1图/30% | 禁止等宽卡片横排(用非对称) | 九大功能模块总览，强调已上线能力矩阵 |
| 08 | 赛程与排班管理 | content | supporting | valley | 左大图+右侧文字 | L2 日历卡示意 | evidence | 220字/1图/25% | 禁止50:50等分 | VLR 自动抓取赛程+北京时间换算+运营排班/请假/值班轮换 |
| 09 | 战队库与看点挖掘 | content | supporting | valley | 非对称双栏 | Diagram(数据分层) | evidence | 240字/1图/22% | 禁止N卡片横排 | 50队注册表+462选手+看点引擎(H2H/恩怨/自动生成)，号角作人工参考源 |
| 10 | 图形工厂 | content | supporting | valley | 左大图+右侧文字 | L2 出图示意 | evidence | 230字/1图/25% | 禁止把图缩小200×70 | 底图驱动+可视化拖拽编辑+中英双图+zip导出，管理员素材后台 |
| 11 | 赛况战报 | content | supporting | valley | 非对称双栏 | Diagram(战报流程) | evidence | 220字/1图/22% | 禁止上下等分 | VLR 事件页抓取→固定模板→EMEA/Americas/Pacific 三联赛 Markdown 直发 |
| 12 | 第三章 开发经验教训 | section | transition | transition | 全屏章节大字 | L1 渐变背景 | atmosphere | 30字/1图/40% | 禁止铺满正文 | 章节编号03 + 标题 |
| 13 | 三大开发教训 | content | supporting | valley | 左标题+右内容 | 3 条要点卡(非对称) | evidence | 300字/0图/25% | 禁止等宽N卡片(用非对称排) | ①白屏防御 ②数据源会失效要重写解析 ③诚实修正分组不可爬 |
| 14 | 数据分层与诚实修正 | content | hero | peak | 巨型数字+洞察 | 大数字 462 | anchor | 200字/1图/30% | 禁止卡片塞数字 | 50队/462选手数据分层(静态fetched+state手动)，VLR standings不可爬→手动录入分组 |
| 15 | 第四章 未来扩展 | section | transition | transition | 全屏章节大字 | L1 渐变背景 | atmosphere | 30字/1图/40% | 禁止铺满正文 | 章节编号04 + 标题 |
| 16 | 私有云部署与 AI 文案 | content | supporting | valley | 非对称双栏 | Diagram(扩展架构) | evidence | 240字/1图/22% | 禁止N卡片横排 | 私有云空间替代 GitHub Pages+Supabase；接入 LLM 实现文案多样化/多语言/自动生成 |
| 17 | 扩展路线图 | content | supporting | valley | 左标题+右内容 | Timeline(路线图) | evidence | 220字/1图/25% | 禁止等宽卡片 | 近期(私有云)/中期(AI文案+完赛记录修复)/远期(多赛事+开放API) |
| 18 | 让运营更轻，让内容更准 | ending | hero | peak | 居中金句+落款 | L1 渐变底 | atmosphere | 30字/0图/35% | 禁止四卡片 | 收束金句 + 团队落款 |
