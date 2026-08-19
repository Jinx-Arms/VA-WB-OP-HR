/* =====================================================
 * cloud.js — 云端模式：Supabase REST API 适配层
 *
 * 部署到 GitHub Pages 时，前端通过 Supabase REST API
 * 直接读写数据库，无需后端服务器。
 *
 * Supabase anon key 可安全暴露在前端（受 RLS 策略保护）。
 * 本地开发（localhost）自动走 server.js 磁盘模式。
 * ===================================================== */
const CLOUD = {
  /* ---- Supabase 配置（部署时填写）---- */
  SUPABASE_URL: 'https://woutedgxmovxjnrfylpr.supabase.co',  // 例: https://abcdefgh.supabase.co
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvdXRlZGd4bW92eGpucmZ5bHByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMzk5MTIsImV4cCI6MjEwMjcxNTkxMn0.NfmGbkuWHHnEJ6vZ4Zy7IFdFY4Z6hF_AlZOud2SrAac',  // anon key（在 Supabase Dashboard > Settings > API 获取）

  /* ---- 检测是否处于云端模式 ---- */
  isCloudMode() {
    if (typeof window === 'undefined') return false;
    const h = window.location.hostname;
    // localhost / 127.0.0.1 / file 协议 → 本地模式
    if (h === 'localhost' || h === '127.0.0.1' || h === '') return false;
    // 配置了 Supabase 且非本地 → 云端模式
    return this.SUPABASE_URL !== '' && this.SUPABASE_KEY !== '';
  },

  /* ---- 请求头 ---- */
  _headers() {
    return {
      'apikey': this.SUPABASE_KEY,
      'Authorization': 'Bearer ' + this.SUPABASE_KEY,
      'Content-Type': 'application/json',
    };
  },

  /* ---- 读取 state ---- */
  async getState() {
    const url = this.SUPABASE_URL + '/rest/v1/kv_store?key=eq.state&select=value';
    const res = await fetch(url, { headers: this._headers() });
    if (!res.ok) throw new Error('Supabase GET ' + res.status);
    const arr = await res.json();
    return arr.length > 0 ? arr[0].value : null;
  },

  /* ---- 写入 state（upsert）---- */
  async setState(state) {
    const url = this.SUPABASE_URL + '/rest/v1/kv_store';
    const res = await fetch(url, {
      method: 'POST',
      headers: Object.assign(this._headers(), { 'Prefer': 'resolution=merge-duplicates' }),
      body: JSON.stringify({ key: 'state', value: state }),
    });
    if (!res.ok) throw new Error('Supabase POST ' + res.status);
  },

  /* ---- 页面关闭时尽力刷写（fetch keepalive）---- */
  async setStateBeacon(state) {
    try {
      await fetch(this.SUPABASE_URL + '/rest/v1/kv_store', {
        method: 'POST',
        headers: Object.assign(this._headers(), { 'Prefer': 'resolution=merge-duplicates' }),
        body: JSON.stringify({ key: 'state', value: state }),
        keepalive: true,
      });
    } catch (e) { /* best effort */ }
  },
};
