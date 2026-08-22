/* =====================================================
 * font-manager.js — 字体注册 / 白名单 / 本地加载
 *  - registerFont(family, url)：注入 @font-face（Storage 或 dataURL）
 *  - loadLocalFont(file)：FontFace API 即时生效（仅本次会话）
 *  - ensureFont(family, weight, size)：渲染前等待字体 ready
 *  - getAllowedFonts()：白名单过滤后的下拉数据（null = 不限制）
 * ===================================================== */
const FONT = {
  _registered: {},   // family -> { url, loaded }
  _loading: {},      // family -> Promise（防重复注册）

  /* 从 URL 注册一个 web font */
  registerFont(family, url){
    if(!family || !url) return Promise.resolve();
    if(this._registered[family] && this._registered[family].loaded) return Promise.resolve();
    if(this._loading[family]) return this._loading[family];
    const p = new Promise((resolve, reject) => {
      try{
        const f = new FontFace(family, 'url(' + url + ')');
        f.load().then(() => {
          document.fonts.add(f);
          this._registered[family] = { url, loaded: true };
          resolve();
        }).catch(e => reject(e));
      }catch(e){ reject(e); }
    });
    this._loading[family] = p;
    return p;
  },

  /* 本地上传字体文件（仅本次会话） */
  async loadLocalFont(file){
    const url = await fileToDataURL(file);
    const base = file.name.replace(/\.[^.]+$/, '').replace(/[^\w\u4e00-\u9fa5-]/g, '_');
    const family = 'local-' + base + '-' + Date.now().toString(36);
    await this.registerFont(family, url);
    return family;
  },

  /* 渲染前确保字体可用；失败不抛错（由调用方决定是否回退） */
  async ensureFont(family, weight, size){
    if(!family || typeof document === 'undefined' || !document.fonts) return;
    try{
      await document.fonts.load((weight ? weight + ' ' : '') + (size ? size + 'px ' : '16px ') + family);
    }catch(e){ /* 忽略，回退默认字体 */ }
  },

  /* 返回白名单字体数组；空数组含义为「不限制」→ 返回 null */
  getAllowedFonts(){
    const allowed = (App.state && App.state.allowedFonts) || [];
    return allowed.length ? allowed.slice() : null;
  },

  /* 给定字体是否在白名单内（不限制时恒为 true） */
  isAllowed(family){
    const allowed = this.getAllowedFonts();
    if(!allowed) return true;
    return allowed.includes(family);
  },

  /* 启动时把 state.fonts 里 scope!=='local' 的字体注册到页面 */
  async registerStateFonts(){
    const fonts = (App.state && App.state.fonts) || [];
    for(const f of fonts){
      if(f.scope === 'local') continue;
      try{ await this.registerFont(f.family, f.url); }catch(e){ console.warn('字体注册失败:', f.family, e.message); }
    }
  }
};
