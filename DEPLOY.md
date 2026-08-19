# VCT 赛事运营中台 — 云端部署指南

## 方案概览

| 组件 | 平台 | 费用 | 银行卡 |
|------|------|------|--------|
| 前端托管 | GitHub Pages | 免费 | 不需要 |
| 数据库 | Supabase | 免费 | 不需要 |
| VLR 定时抓取 | GitHub Actions | 免费 | 不需要 |

全程零费用，只需要一个 GitHub 账号。

---

## 第一步：创建 Supabase 数据库（3 分钟）

1. 打开 https://supabase.com，点 **Start your project**，用 GitHub 账号登录
2. 点 **New Project**，填写：
   - **Name**：`vct-ops`（随便填）
   - **Database Password**：设一个密码（记好，后面要用的连接串里包含它）
   - **Region**：`Southeast Asia (Singapore)`（离国内最近）
3. 等待约 1-2 分钟，项目创建完成
4. 左侧菜单点 **SQL Editor** → **New query**
5. 把仓库里的 `supabase-setup.sql` 全部内容粘贴进去，点 **Run**
   - 这会创建 `kv_store` 表并配置访问权限
6. 左侧菜单点 **Project Settings**（齿轮图标）→ **API**
7. 找到以下两项，复制保存：
   - **Project URL**：类似 `https://abcdefgh.supabase.co`
   - **anon public key**：一长串 `eyJ...` 开头的字符串

---

## 第二步：填写云端配置并推送（2 分钟）

1. 打开项目 `js/cloud.js` 文件
2. 填入你的 Supabase 信息：
   ```js
   SUPABASE_URL: 'https://你的项目地址.supabase.co',
   SUPABASE_KEY: 'eyJ...你的anon key...',
   ```
3. 保存后提交并推送：
   ```bash
   git add -A
   git commit -m "配置 Supabase 云端模式"
   git push
   ```

> anon key 设计上就是公开的，安全性由 Supabase RLS 策略保护，放在前端代码中没有问题。

---

## 第三步：开启 GitHub Pages（1 分钟）

1. 打开你的 GitHub 仓库：https://github.com/Jinx-Arms/VA-WB-OP-HR
2. 点 **Settings** → 左侧 **Pages**
3. **Source** 选 **Deploy from a branch**
4. **Branch** 选 `main`，文件夹选 `/ (root)`，点 **Save**
5. 等待 1-2 分钟，页面顶部会显示公网地址：
   ```
   https://jinx-arms.github.io/VA-WB-OP-HR/
   ```
6. 打开这个地址，应该能看到登录页面

---

## 第四步：验证

1. 打开 GitHub Pages 地址，用默认管理员账号登录
   - 账号：`S1`（工号），或直接点登录页的陈默
2. 添加一条测试数据（如排个班），刷新页面确认数据还在
3. 换一台电脑/手机打开同一地址，确认数据同步

---

## VLR 赛程自动更新

已配置 GitHub Actions 每天北京时间 06:00 自动抓取 VLR 赛程：

- 工作流文件：`.github/workflows/scrape-vlr.yml`
- 抓取脚本：`scripts/scrape.js`
- 输出文件：`data/fetched-schedule.json`（自动提交回仓库）

手动触发：GitHub 仓库 → **Actions** → **VLR Schedule Scraper** → **Run workflow**

---

## 团队成员使用

把 GitHub Pages 地址发给团队成员：
```
https://jinx-arms.github.io/VA-WB-OP-HR/
```
各自用电脑/手机浏览器打开即可，无需安装任何东西。

---

## 本地开发

本地运行时（localhost），系统自动走磁盘文件模式，不影响云端数据：

```bash
node server.js
# 访问 http://localhost:3000
```

---

## 常见问题

**Q: GitHub Pages 打开后白屏？**
A: 检查浏览器控制台（F12），确认 `js/cloud.js` 里的 Supabase URL 和 Key 已正确填写。

**Q: 数据没保存？**
A: 确认 `supabase-setup.sql` 已在 Supabase SQL Editor 中执行成功。

**Q: VLR 赛程没更新？**
A: 去 GitHub 仓库 → Actions 页面查看工作流运行日志。
