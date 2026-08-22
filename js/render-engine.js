/* =====================================================
 * render-engine.js — 纯 Canvas 渲染引擎
 *  - 底图 + 结构化变量 → PNG，零 PS
 *  - 模板 = JSON 数据，新增图种无需改引擎
 *  - 函数均为纯逻辑，可单测
 * ===================================================== */
const RENDER = {
  /* ---------- 遮罩注册表（可扩展） ---------- */
  MASKS: {
    rect(ctx, x, y, w, h){ /* 无裁剪 */ },
    circle(ctx, x, y, w, h){
      ctx.beginPath();
      ctx.arc(x + w/2, y + h/2, Math.min(w, h)/2, 0, Math.PI*2);
      ctx.clip();
    },
    arch(ctx, x, y, w, h){
      const r = w/2;
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x, y + r);
      ctx.arc(x + r, y + r, r, Math.PI, 0);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.clip();
    },
    rounded(ctx, x, y, w, h){
      const r = Math.min(w, h) * 0.12;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.clip();
    }
  },

  _imgCache: {},

  /* 加载图片（缓存 + crossOrigin 防污染） */
  loadImage(url){
    if(!url) return Promise.reject(new Error('empty url'));
    if(this._imgCache[url]) return this._imgCache[url];
    const p = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { this._imgCache[url] = Promise.resolve(img); resolve(img); };
      img.onerror = () => { reject(new Error('图片加载失败: ' + url)); };
      img.src = url;
    });
    this._imgCache[url] = p;
    return p;
  },

  /* ---------- 通用路径解析 ----------
   * 支持 'matches[0].teamA.logo'、'team.roster[3].id'、'meta.date'
   */
  resolveSource(path, ctx){
    if(!path || path === 'literal') return undefined;
    const re = /([A-Za-z_$][\w$]*)|\[(\d+)\]/g;
    let m, cur = ctx;
    while((m = re.exec(path)) !== null){
      if(cur == null) break;
      if(m[1] !== undefined) cur = cur[m[1]];
      else if(m[2] !== undefined) cur = cur[+m[2]];
      if(cur === undefined) break;
    }
    return cur;
  },

  /* ---------- 战队上下文 ---------- */
  teamCtx(teamId, lang){
    const t = (App.state.teams || {})[teamId];
    if(!t) return null;
    const pick = (cn, en) => lang === 'en' ? (en || cn) : cn;
    return {
      id: t.id,
      name: pick(t.name, t.nameEn),
      nameEn: t.nameEn || t.name,
      shortName: pick(t.shortName, t.shortNameEn),
      shortNameEn: t.shortNameEn || t.shortName,
      logo: t.logo || '',
      roster: (t.roster || []).map(p => ({
        id: p.id, name: p.name || '', avatar: p.avatar || '', number: p.number || '', formerTeams: p.formerTeams || []
      })),
      coaches: (t.coaches || []).map(c => ({
        id: c.id, name: c.name || '', role: c.role || '', avatar: c.avatar || ''
      }))
    };
  },

  /* 把 'AG vs TE' 解析为带 logo/shortName 的 teamA/teamB 对象 */
  resolveMatch(m, lang){
    const [aId, bId] = App.findTeamKey(m.teams || '');
    const teamA = aId ? this.teamCtx(aId, lang) : { id:null, name:'', shortName:m.teams.split(/\s+vs?\s+/i)[0]||'', logo:'' };
    const teamB = bId ? this.teamCtx(bId, lang) : { id:null, name:'', shortName:(m.teams.split(/\s+vs?\s+/i)[1]||''), logo:'' };
    const casters = (m.casterIds || []).map(cid => {
      const c = (App.state.casters || []).find(x => x.id === cid);
      return c ? { id:c.id, name:c.name||'', role:c.role||'', portrait:c.portrait||'' } : null;
    }).filter(Boolean);
    return { time: m.time || '', stage: m.stage || '', name: m.name || '', teamA, teamB, casters };
  },

  /* ---------- 构建渲染上下文 ctx ---------- */
  buildCtx(tpl, source, lang){
    const ctx = { lang, meta:{}, matches:[], team:null, casters: App.state.casters || [] };
    const meta = tpl.meta || {};
    ctx.meta.title = lang === 'en' ? (meta.titleEn || meta.title || '') : (meta.title || '');
    ctx.meta.subtitle = lang === 'en' ? (meta.subtitleEn || meta.subtitle || '') : (meta.subtitle || '');
    if(source.kind === 'date'){
      const date = source.value;
      ctx.meta.date = D.parse(date).getMonth()+1 + '月' + D.parse(date).getDate() + '日';
      ctx.meta.weekday = '星期' + D.weekdayCN(date);
      ctx.meta.dateISO = date;
      const day = App.state.scheduleDays[date];
      ctx.matches = ((day && day.matches) || []).map(m => this.resolveMatch(m, lang));
    } else if(source.kind === 'team'){
      ctx.team = this.teamCtx(source.value, lang);
      ctx.meta.dateISO = source.date || D.today();
    }
    return ctx;
  },

  /* ---------- 分组步长向量 ---------- */
  _strideVec(tpl, groupName){
    const grp = (tpl.groups || {})[groupName] || {};
    const dir = grp.repeatDirection || 'vertical';
    const gap = grp.repeatGap != null ? grp.repeatGap : 40;
    let stride = grp.stride;
    if(!stride){
      // 回退：取该组所有槽位最大尺寸 + gap
      const slots = (tpl.slots || []).filter(s => (s.group || 'static') === groupName);
      const maxDim = slots.reduce((mx, s) => Math.max(mx, dir === 'horizontal' ? (s.w||100) : (s.h||100)), 100);
      stride = maxDim + gap;
    }
    return dir === 'horizontal' ? { dx: stride, dy: 0 } : { dx: 0, dy: stride };
  },

  /* ---------- 展开槽位为实例清单 ---------- */
  instances(tpl, ctx){
    const out = [];
    const missing = [];
    const mv = this._strideVec(tpl, 'match');
    const pv = this._strideVec(tpl, 'player');
    const cv = this._strideVec(tpl, 'coach');
    const cav = this._strideVec(tpl, 'caster');
    const matchGrp = (tpl.groups || {}).match || {};
    const castGrp = (tpl.groups || {}).caster || {};

    for(const slot of (tpl.slots || [])){
      const g = slot.group || 'static';
      let reps = [];
      if(g === 'static' || !g){
        reps = [{ i:0, j:0, offX:0, offY:0, source: slot.source }];
      } else if(g === 'match'){
        const n = ctx.matches.length;
        for(let i=0;i<n;i++) reps.push({ i, j:0, offX: mv.dx*i, offY: mv.dy*i, source: (slot.source||'').replace(/\[i\]/g,'['+i+']') });
      } else if(g === 'player'){
        const n = (ctx.team && ctx.team.roster.length) || 0;
        for(let i=0;i<n;i++) reps.push({ i, j:0, offX: pv.dx*i, offY: pv.dy*i, source: (slot.source||'').replace(/\[i\]/g,'['+i+']') });
      } else if(g === 'coach'){
        const n = (ctx.team && ctx.team.coaches.length) || 0;
        for(let i=0;i<n;i++) reps.push({ i, j:0, offX: cv.dx*i, offY: cv.dy*i, source: (slot.source||'').replace(/\[i\]/g,'['+i+']') });
      } else if(g === 'caster'){
        const useMatch = castGrp.matchIndex === 'any';
        const matchesArr = useMatch ? ctx.matches : (ctx.matches.slice(0,1));
        for(let i=0;i<matchesArr.length;i++){
          const cas = (matchesArr[i].casters || []);
          for(let j=0;j<cas.length;j++){
            reps.push({
              i, j,
              offX: mv.dx*i + cav.dx*j,
              offY: mv.dy*i + cav.dy*j,
              source: (slot.source||'').replace(/\[i\]/g,'['+i+']').replace(/\[j\]/g,'['+j+']')
            });
          }
        }
      }

      reps.forEach(r => {
        let data = this.resolveSource(r.source, ctx);
        if(slot.type === 'image' && (data === undefined || data === null || data === '')){
          missing.push({ key: slot.key, label: this._missingLabel(slot, r) });
        }
        out.push({
          slot, i:r.i, j:r.j,
          x: slot.x + r.offX,
          y: slot.y + r.offY,
          w: slot.w, h: slot.h,
          data: (data === undefined ? null : data),
          source: r.source
        });
      });
    }
    return { instances: out, missing };
  },

  _missingLabel(slot, r){
    const tag = (slot.group || 'static') === 'match' ? ('第'+(r.i+1)+'场 ') :
                (slot.group === 'caster') ? ('第'+(r.i+1)+'场 解说'+(r.j+1)+' ') :
                (slot.group === 'player') ? ('选手'+(r.i+1)+' ') :
                (slot.group === 'coach') ? ('教练'+(r.i+1)+' ') : '';
    const name = { logo:'队徽', avatar:'头像', portrait:'定妆照' }[slot.shape] || '素材';
    return tag + name + '（' + (slot.key) + '）缺失';
  },

  /* ---------- 绘制单个槽位 ---------- */
  async renderSlot(inst, ctx, opts){
    opts = opts || {};
    const slot = inst.slot;
    const override = (opts.overrides && opts.overrides[slot.key]) || {};
    if(slot.type === 'image'){
      const url = inst.data;
      const shape = slot.shape || 'rect';
      ctx.save();
      const maskFn = this.MASKS[shape] || this.MASKS.rect;
      maskFn(ctx, inst.x, inst.y, inst.w, inst.h);
      if(url){
        try{
          const img = await this.loadImage(url);
          this._drawCover(ctx, img, inst.x, inst.y, inst.w, inst.h);
        }catch(e){
          this._drawPlaceholder(ctx, inst.x, inst.y, inst.w, inst.h);
        }
      } else {
        this._drawPlaceholder(ctx, inst.x, inst.y, inst.w, inst.h);
      }
      ctx.restore();
      return;
    }
    // text
    let text = override.text;
    if(text === undefined) text = inst.data;
    if(text === undefined || text === null) text = slot.staticText;
    if(text === undefined || text === null) text = slot.defaultValue;
    if(text === undefined || text === null) text = '';
    const size = override.size != null ? override.size : (slot.size || 28);
    const color = override.color || slot.color || '#ffffff';
    const align = override.align || slot.align || 'left';
    const font = override.font || slot.font || 'sans-serif';
    const weight = slot.weight || 400;
    ctx.save();
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = align;
    ctx.font = weight + ' ' + size + 'px "' + font + '", sans-serif';
    if('letterSpacing' in ctx && slot.letterSpacing) ctx.letterSpacing = slot.letterSpacing + 'px';
    const tx = align === 'center' ? inst.x + inst.w/2 : (align === 'right' ? inst.x + inst.w : inst.x);
    const ty = inst.y + inst.h/2;
    ctx.fillText(String(text), tx, ty);
    ctx.restore();
  },

  _drawCover(ctx, img, x, y, w, h){
    const ir = img.width / img.height, br = w / h;
    let sw, sh, sx, sy;
    if(ir > br){ sh = img.height; sw = sh * br; sx = (img.width - sw)/2; sy = 0; }
    else { sw = img.width; sh = sw / br; sx = 0; sy = (img.height - sh)/2; }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  },

  _drawPlaceholder(ctx, x, y, w, h){
    ctx.save();
    ctx.fillStyle = 'rgba(120,120,120,0.35)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('缺素材', x + w/2, y + h/2);
    ctx.restore();
  },

  /* ---------- 渲染整张模板 ---------- */
  async renderTemplate(tpl, source, opts){
    opts = opts || {};
    const lang = opts.lang || 'zh';
    const scale = Math.max(0.1, Math.min(10, opts.scale || 1));
    const ctxData = this.buildCtx(tpl, source, lang);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(tpl.size.w * scale);
    canvas.height = Math.round(tpl.size.h * scale);
    const c = canvas.getContext('2d');
    c.scale(scale, scale);

    if(tpl.base){
      try{
        const base = await this.loadImage(tpl.base);
        c.drawImage(base, 0, 0, tpl.size.w, tpl.size.h);
      }catch(e){ /* 无底图时透明背景 */ }
    }
    const { instances, missing } = this.instances(tpl, ctxData);
    /* 渲染前确保引用字体 ready（5.5） */
    if(typeof document !== 'undefined' && document.fonts){
      const fontSet = new Set();
      instances.forEach(inst => {
        if(inst.slot.type === 'text'){
          const ov = (opts.overrides && opts.overrides[inst.slot.key]) || {};
          const f = ov.font || inst.slot.font || 'sans-serif';
          const w = inst.slot.weight || 400;
          fontSet.add(w + ' 16px "' + f + '"');
        }
      });
      try{ await Promise.all([...fontSet].map(s => document.fonts.load(s))); }catch(e){}
    }
    for(const inst of instances){
      await this.renderSlot(inst, c, { overrides: opts.overrides });
    }
    return { canvas, missing, ctx: ctxData };
  },

  renderToBlob(canvas){
    return new Promise(resolve => {
      if(canvas.toBlob) canvas.toBlob(b => resolve(b), 'image/png');
      else resolve(dataURLToBlob(canvas.toDataURL('image/png')));
    });
  },

  /* ---------- 批量渲染（含中英双语翻倍） ----------
   * jobs: [{ source, lang, name }]
   */
  async batchRender(tpl, jobs, opts, onProgress){
    const items = [];
    const total = jobs.length;
    let done = 0;
    for(const job of jobs){
      const res = await this.renderTemplate(tpl, job.source, { scale: opts.scale, lang: job.lang, overrides: opts.overrides });
      const blob = await this.renderToBlob(res.canvas);
      items.push({ blob, name: job.name, missing: res.missing });
      done++;
      if(onProgress) onProgress(done, total);
    }
    return items;
  },

  /* ---------- 打包 zip（懒加载 JSZip） ---------- */
  async exportZip(items, zipName){
    const loadJSZip = () => new Promise((resolve, reject) => {
      if(typeof JSZip !== 'undefined') return resolve(JSZip);
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
      s.onload = () => resolve(JSZip);
      s.onerror = () => reject(new Error('JSZip 加载失败'));
      document.head.appendChild(s);
    });
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    items.forEach(it => zip.file(it.name, it.blob));
    return await zip.generateAsync({ type: 'blob' });
  }
};
