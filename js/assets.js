/* =====================================================
 * assets.js — 素材存储封装（Supabase Storage REST）
 * 云端模式：上传到 bucket `assets`；本地模式：降级为 base64 dataURL。
 * 所有写操作由调用方负责权限守卫（见 view-assets.js）。
 * ===================================================== */
const ASSETS = {
  bucket: 'assets',

  _headers(){ return CLOUD._headers(); },

  /* 本地模式（localhost / 服务器磁盘）：素材以 base64 内联，不依赖 Supabase */
  isLocal(){ return !CLOUD.isCloudMode(); },

  /* 上传文件，返回可公开访问的 URL（http 或 dataURL）
   * folder: 'logos' | 'portraits' | 'coaches' | 'casters' | 'templates' | 'fonts' | 'outputs'
   */
  async upload(file, folder, filename){
    if(this.isLocal()){
      return await fileToDataURL(file);
    }
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const safeName = (filename || (Date.now() + '_' + Math.random().toString(36).slice(2, 8))) + '.' + ext;
    const path = folder + '/' + safeName;
    const url = CLOUD.SUPABASE_URL + '/storage/v1/object/' + this.bucket + '/' + path;
    const res = await fetch(url, {
      method: 'POST',
      headers: Object.assign(this._headers(), {
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'true'
      }),
      body: file
    });
    if(!res.ok) throw new Error('Storage 上传失败 HTTP ' + res.status);
    return this.publicUrl(path);
  },

  /* 由相对 path 拼出公开 URL */
  publicUrl(path){
    if(!path) return '';
    if(path.startsWith('data:') || path.startsWith('http')) return path;
    return CLOUD.SUPABASE_URL + '/storage/v1/object/public/' + this.bucket + '/' + path;
  },

  /* 删除文件 */
  async remove(path){
    if(this.isLocal() || !path || path.startsWith('data:') || path.startsWith('http')) return;
    const url = CLOUD.SUPABASE_URL + '/storage/v1/object/' + this.bucket + '/' + path;
    await fetch(url, { method: 'DELETE', headers: this._headers() }).catch(() => {});
  },

  /* 列出目录（仅云端） */
  async list(folder){
    if(this.isLocal()) return [];
    const url = CLOUD.SUPABASE_URL + '/storage/v1/object/list/' + this.bucket + '?prefix=' + encodeURIComponent(folder);
    try{
      const res = await fetch(url, { method: 'POST', headers: this._headers(), body: '{}' });
      if(!res.ok) return [];
      return await res.json();
    }catch(e){ return []; }
  }
};

/* FileReader → base64 dataURL（本地模式素材内联） */
function fileToDataURL(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('读取文件失败'));
    r.readAsDataURL(file);
  });
}

/* dataURL → Blob（用于导出时统一处理） */
function dataURLToBlob(dataURL){
  const [head, body] = dataURL.split(',');
  const mime = (head.match(/:(.*?);/) || [,'image/png'])[1];
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
