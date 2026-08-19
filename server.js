/* =====================================================
 * server.js — VCT 赛事运营中台服务器
 *
 * 存储模式（自动切换）：
 *  · 云端部署：设置 DATABASE_URL 环境变量 → PostgreSQL 持久化
 *  · 本地开发：未设置 DATABASE_URL → 磁盘文件持久化（data/ 目录）
 *
 * 功能：
 *  1. 托管静态资源（index.html / css / js）
 *  2. REST API：GET/POST /api/state、POST /api/reset、GET /api/health
 *  3. 数据持久化（PostgreSQL 或磁盘文件）
 *  4. VLR 赛程抓取：POST /api/schedule-fetch、GET /api/schedule-cache
 *  5. 每日 6:00 自动抓取 VLR 赛程
 *
 * 启动：node server.js  （或 npm start）
 * 本地访问：http://localhost:3000
 * 云端访问：Render 自动分配的公网 URL
 * ===================================================== */
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const { fetchVLRSchedule, fetchVLRTeams } = require('./js/vlr-scraper.js');
const { VCT_TEAMS } = require('./js/vct-teams.js');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR    = path.join(ROOT, 'data');
const STATE_FILE  = path.join(DATA_DIR, 'state.json');
const FETCH_FILE  = path.join(DATA_DIR, 'fetched-schedule.json');
const FETCH_TEAMS_FILE = path.join(DATA_DIR, 'fetched-teams.json');

/* =====================================================
 * 存储抽象层
 * ===================================================== */

const USE_DB = !!process.env.DATABASE_URL;
let pgPool = null;

if (USE_DB) {
  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  pgPool.on('error', (err) => {
    console.error('[DB] 连接池异常:', err.message);
  });
  console.log('[存储] 使用 PostgreSQL 数据库');
} else {
  console.log('[存储] 使用磁盘文件（本地模式）');
}

/* ---------- 初始化数据库表 ---------- */
async function initDB() {
  if (!USE_DB) return;
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS kv_store (
        key        TEXT PRIMARY KEY,
        value      JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('[DB] kv_store 表就绪');
  } catch (e) {
    console.error('[DB] 建表失败:', e.message);
    console.error('[DB] 请检查 DATABASE_URL 是否正确');
    process.exit(1);
  }
}

/* ---------- 通用 key-value 读写 ---------- */
async function dbGet(key) {
  if (USE_DB) {
    const res = await pgPool.query('SELECT value FROM kv_store WHERE key = $1', [key]);
    return res.rows.length > 0 ? res.rows[0].value : null;
  }
  // 磁盘模式
  const file = keyToFile(key);
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  return null;
}

async function dbSet(key, value) {
  if (USE_DB) {
    await pgPool.query(`
      INSERT INTO kv_store (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
    `, [key, JSON.stringify(value)]);
    return;
  }
  // 磁盘模式：原子写
  ensureDataDir();
  const file = keyToFile(key);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

async function dbDelete(key) {
  if (USE_DB) {
    await pgPool.query('DELETE FROM kv_store WHERE key = $1', [key]);
    return;
  }
  // 磁盘模式
  const file = keyToFile(key);
  try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (e) {}
}

/* ---------- key → 文件路径映射 ---------- */
function keyToFile(key) {
  if (key === 'state') return STATE_FILE;
  if (key === 'vlr_schedule') return FETCH_FILE;
  if (key === 'vlr_teams') return FETCH_TEAMS_FILE;
  return path.join(DATA_DIR, key + '.json');
}

/* =====================================================
 * 业务读写（基于存储抽象层）
 * ===================================================== */

function ensureDataDir() {
  if (!USE_DB && !fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function readState() {
  try {
    return await dbGet('state');
  } catch (e) {
    console.error('[state] 读取失败:', e.message);
    return null;
  }
}

async function writeState(obj) {
  try {
    await dbSet('state', obj);
  } catch (e) {
    console.error('[state] 写入失败:', e.message);
  }
}

/* ---------- 静态文件 MIME ---------- */
const MIME = {
  '.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.js':'application/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.ico':'image/x-icon'
};
function serveStatic(req, res, urlPath) {
  const safe = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
  let fp = path.join(ROOT, safe);
  if(safe === '/' || safe === path.sep) fp = path.join(ROOT, 'index.html');
  if(!fs.existsSync(fp) || fs.statSync(fp).isDirectory()){
    if(fs.existsSync(path.join(fp, 'index.html'))) fp = path.join(fp, 'index.html');
    else { res.writeHead(404); res.end('404 Not Found'); return; }
  }
  const ext = path.extname(fp).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
}

/* ---------- API 路由 ---------- */
function readBody(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch(e) { resolve(null); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  /* CORS */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method === 'OPTIONS'){ res.writeHead(204); res.end(); return; }

  /* ---------- API: 状态读写 ---------- */
  if(p === '/api/state') {
    if(req.method === 'GET') {
      const st = await readState();
      res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8' });
      res.end(JSON.stringify(st || {}));
      return;
    }
    if(req.method === 'POST') {
      const body = await readBody(req);
      if(body) {
        await writeState(body);
        res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok:true }));
      } else {
        res.writeHead(400);
        res.end(JSON.stringify({ ok:false, error:'bad json' }));
      }
      return;
    }
  }

  /* ---------- API: 重置 ---------- */
  if(p === '/api/reset' && req.method === 'POST') {
    await dbDelete('state');
    res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok:true }));
    return;
  }

  /* ---------- API: 健康检查 ---------- */
  if(p === '/api/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok:true, ts:Date.now(), storage: USE_DB ? 'postgresql' : 'disk' }));
    return;
  }

  /* ---------- API: VLR 赛程抓取 ---------- */
  if(p === '/api/schedule-fetch') {
    if(req.method !== 'POST' && req.method !== 'GET') {
      res.writeHead(405); res.end(); return;
    }
    try {
      const result = await fetchVLRSchedule();
      await dbSet('vlr_schedule', result);
      const dayCount = Object.keys(result.days).length;
      console.log('[VLR] 抓取完成: %d 个比赛日, %d 个错误', dayCount, result.errors.length);
      res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    } catch(e) {
      console.error('[VLR] 抓取异常:', e.message);
      res.writeHead(502, { 'Content-Type':'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok:false, error:e.message, days:{}, errors:[] }));
    }
    return;
  }

  /* ---------- API: 读取 VLR 缓存 ---------- */
  if(p === '/api/schedule-cache' && req.method === 'GET') {
    try {
      const cached = await dbGet('vlr_schedule');
      if(cached) {
        res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8' });
        res.end(JSON.stringify(cached));
      } else {
        res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8' });
        res.end(JSON.stringify({ days:{}, errors:[], fetchedAt:null }));
      }
    } catch(e) {
      res.writeHead(500, { 'Content-Type':'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok:false, error:e.message }));
    }
    return;
  }

  /* ---------- API: VLR 战队数据抓取 ---------- */
  if(p === '/api/teams-fetch') {
    if(req.method !== 'POST' && req.method !== 'GET') {
      res.writeHead(405); res.end(); return;
    }
    try {
      const result = await fetchVLRTeams(VCT_TEAMS);
      await dbSet('vlr_teams', result);
      const teamCount = Object.keys(result.teams).length;
      console.log('[VLR Teams] 抓取完成: %d 队, %d 个错误', teamCount, result.errors.length);
      res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    } catch(e) {
      console.error('[VLR Teams] 抓取异常:', e.message);
      res.writeHead(502, { 'Content-Type':'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok:false, error:e.message, teams:{}, errors:[] }));
    }
    return;
  }

  /* ---------- API: 读取 VLR 战队缓存 ---------- */
  if(p === '/api/teams-cache' && req.method === 'GET') {
    try {
      const cached = await dbGet('vlr_teams');
      if(cached) {
        res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8' });
        res.end(JSON.stringify(cached));
      } else {
        res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8' });
        res.end(JSON.stringify({ teams:{}, errors:[], fetchedAt:null }));
      }
    } catch(e) {
      res.writeHead(500, { 'Content-Type':'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok:false, error:e.message }));
    }
    return;
  }

  /* ---------- 静态资源 ---------- */
  if(req.method === 'GET') {
    serveStatic(req, res, p);
    return;
  }

  res.writeHead(404);
  res.end('404 Not Found');
});

/* =====================================================
 * 启动
 * ===================================================== */
async function start() {
  await initDB();
  ensureDataDir();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  VCT 赛事运营中台 · 服务器已启动`);
    console.log(`  ────────────────────────────────────`);
    console.log(`  访问地址：http://localhost:${PORT}`);
    console.log(`  存储模式：${USE_DB ? 'PostgreSQL' : '磁盘文件'}`);
    if(!USE_DB) {
      console.log(`  数据文件：${STATE_FILE}`);
      console.log(`  赛程缓存：${FETCH_FILE}`);
      console.log(`  战队缓存：${FETCH_TEAMS_FILE}`);
    }
    console.log(`  按 Ctrl+C 停止\n`);

    checkInitialFetch();
    scheduleDailyFetch();
  });
}

/* ---------- 每日 6:00 自动抓取 ---------- */
function scheduleDailyFetch() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(6, 0, 0, 0);
  if(next <= now) next.setDate(next.getDate() + 1);
  const ms = next - now;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  console.log('[定时] 下次 VLR 抓取: %s（约 %d 小时 %d 分钟后）',
    next.toLocaleString('zh-CN'), h, m);

  setTimeout(async () => {
    console.log('[定时] 开始执行每日 VLR 赛程抓取...');
    try {
      const result = await fetchVLRSchedule();
      await dbSet('vlr_schedule', result);
      const dayCount = Object.keys(result.days).length;
      console.log('[定时] 抓取完成: %d 个比赛日, %d 个错误', dayCount, result.errors.length);
      if(result.errors.length) {
        result.errors.forEach(e => console.log('  ⚠ %s: %s', e.event, e.error));
      }
    } catch(e) {
      console.error('[定时] 抓取失败:', e.message);
    }
    /* 每日同时抓取战队数据 */
    try {
      console.log('[定时] 开始抓取战队数据...');
      const teamsResult = await fetchVLRTeams(VCT_TEAMS);
      await dbSet('vlr_teams', teamsResult);
      const teamCount = Object.keys(teamsResult.teams).length;
      console.log('[定时] 战队抓取完成: %d 队, %d 个错误', teamCount, teamsResult.errors.length);
    } catch(e) {
      console.error('[定时] 战队抓取失败:', e.message);
    }
    scheduleDailyFetch();
  }, ms);
}

/* ---------- 启动时检查是否需要立即抓取 ---------- */
async function checkInitialFetch() {
  try {
    const cached = await dbGet('vlr_schedule');
    if(cached && cached.fetchedAt) {
      const lastFetched = new Date(cached.fetchedAt);
      if(Date.now() - lastFetched.getTime() < 20 * 3600000) {
        console.log('[VLR] 上次抓取于 %s，无需立即更新', cached.fetchedAt);
        return;
      }
    }
    console.log('[VLR] 启动时执行一次抓取...');
    const result = await fetchVLRSchedule();
    await dbSet('vlr_schedule', result);
    console.log('[VLR] 启动抓取完成: %d 个比赛日', Object.keys(result.days).length);
  } catch(e) {
    console.error('[VLR] 启动抓取失败:', e.message);
  }
}

/* ---------- 优雅关闭 ---------- */
process.on('SIGTERM', async () => {
  console.log('[服务器] 收到 SIGTERM，正在关闭...');
  server.close(() => {
    if(pgPool) pgPool.end();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n[服务器] 正在关闭...');
  server.close(() => {
    if(pgPool) pgPool.end();
    process.exit(0);
  });
});

/* ---------- 启动！ ---------- */
start().catch(e => {
  console.error('[启动失败]', e);
  process.exit(1);
});
