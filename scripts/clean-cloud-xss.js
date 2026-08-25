/* 方案 A：清理云端 XSS 测试残留
 * 流程：1) GET 备份 → 2) 字段级清洗（按字段内容定位，不靠 index） → 3) POST upsert → 4) GET 校验
 */
const URL='https://woutedgxmovxjnrfylpr.supabase.co/rest/v1/kv_store';
const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvdXRlZGd4bW92eGpucmZ5bHByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMzk5MTIsImV4cCI6MjEwMjcxNTkxMn0.NfmGbkuWHHnEJ6vZ4Zy7IFdFY4Z6hF_AlZOud2SrAac';
const CLEAN = '(已清理 XSS 测试残留)';
const RISK = /<|>|onerror=|onload=|javascript:/i;
const HEAD_GET  = {apikey:KEY, Authorization:'Bearer '+KEY};
const HEAD_PUT  = {apikey:KEY, Authorization:'Bearer '+KEY, 'Content-Type':'application/json',
                    Prefer:'resolution=merge-duplicates,return=representation'};
const fs = require('fs');

(async () => {
  /* 1) 备份 */
  const r1 = await fetch(URL + '?key=eq.state&select=updated_at,value', {headers:HEAD_GET});
  if (!r1.ok) { console.log('GET backup FAIL', r1.status); return; }
  const arr = await r1.json();
  const originalRow = arr[0];
  if (!originalRow) { console.log('no row'); return; }
  fs.writeFileSync('scripts/cloud-backup-before-clean.json',
    JSON.stringify({updated_at:originalRow.updated_at, value:originalRow.value}, null, 2));
  console.log('✓ 备份已保存到 scripts/cloud-backup-before-clean.json');
  console.log('  备份时 updated_at:', originalRow.updated_at);

  /* 2) 深拷贝 + 字段级清洗（按内容定位，不靠 index，避免数组顺序变了改错） */
  const v = JSON.parse(JSON.stringify(originalRow.value));
  const changes = [];

  // staff[*].name / position（含 payload → 还原或清理）
  (v.staff||[]).forEach(s => {
    if (s.name && RISK.test(s.name)) {
      const newName = (s.id === 'S3') ? '王锐' : CLEAN;
      changes.push(`staff[${s.id}].name: ${JSON.stringify(s.name).slice(0,40)} → "${newName}"`);
      s.name = newName;
    }
    if (s.position && RISK.test(s.position)) {
      changes.push(`staff[${s.id}].position: ${JSON.stringify(s.position).slice(0,40)} → "${CLEAN}"`);
      s.position = CLEAN;
    }
  });

  // leave[*].reason / comment
  (v.leave||[]).forEach((l, i) => {
    if (RISK.test(l.reason||'')) {
      changes.push(`leave[${i}|${l.id}].reason: ${JSON.stringify(l.reason).slice(0,40)} → "${CLEAN}"`);
      l.reason = CLEAN;
    }
    if (RISK.test(l.comment||'')) {
      changes.push(`leave[${i}|${l.id}].comment: ${JSON.stringify(l.comment).slice(0,40)} → "${CLEAN}"`);
      l.comment = CLEAN;
    }
  });

  // content[*].title / note
  (v.content||[]).forEach((c, i) => {
    if (RISK.test(c.title||'')) {
      changes.push(`content[${i}|${c.id}].title: ${JSON.stringify(c.title).slice(0,40)} → "${CLEAN}"`);
      c.title = CLEAN;
    }
    if (RISK.test(c.note||'')) {
      changes.push(`content[${i}|${c.id}].note: ${JSON.stringify(c.note).slice(0,40)} → "${CLEAN}"`);
      c.note = CLEAN;
    }
  });

  // handovers[*].note + items[*].title
  (v.handovers||[]).forEach((h, i) => {
    if (RISK.test(h.note||'')) {
      changes.push(`handovers[${i}|${h.id}].note: ${JSON.stringify(h.note).slice(0,40)} → "${CLEAN}"`);
      h.note = CLEAN;
    }
    (h.items||[]).forEach((it, j) => {
      if (RISK.test(it.title||'')) {
        changes.push(`handovers[${i}|${h.id}].items[${j}].title: ${JSON.stringify(it.title).slice(0,40)} → "${CLEAN}"`);
        it.title = CLEAN;
      }
    });
  });

  // notifications[*].text
  (v.notifications||[]).forEach((n, i) => {
    if (RISK.test(n.text||'')) {
      changes.push(`notifications[${i}].text: ${JSON.stringify(n.text).slice(0,40)} → "${CLEAN}"`);
      n.text = CLEAN;
    }
  });

  // matchups[key].notes[*].text（matchups 是对象：{ [key]: { notes: [...] } }）
  Object.keys(v.matchups||{}).forEach(k => {
    (v.matchups[k]?.notes || []).forEach((n, j) => {
      if (RISK.test(n.text||'')) {
        changes.push(`matchups[${k}].notes[${j}].text: ${JSON.stringify(n.text).slice(0,40)} → "${CLEAN}"`);
        n.text = CLEAN;
      }
    });
  });

  // highlights[*].text
  (v.highlights||[]).forEach((h, i) => {
    if (RISK.test(h.text||'')) {
      changes.push(`highlights[${i}].text: ${JSON.stringify(h.text).slice(0,40)} → "${CLEAN}"`);
      h.text = CLEAN;
    }
    if (RISK.test(h.title||'')) {
      changes.push(`highlights[${i}].title: ${JSON.stringify(h.title).slice(0,40)} → "${CLEAN}"`);
      h.title = CLEAN;
    }
  });

  console.log('\n=== 计划变更（共 ' + changes.length + ' 处） ===');
  changes.forEach(c => console.log('  ' + c));

  if (changes.length === 0) {
    console.log('未发现 payload，退出');
    return;
  }

  /* 3) POST upsert 整行 */
  const r2 = await fetch(URL, {method:'POST', headers:HEAD_PUT,
    body: JSON.stringify({key:'state', value:v})});
  console.log('\nPOST status:', r2.status);
  const returned = r2.ok ? await r2.json() : null;
  if (returned && returned[0]) {
    console.log('云端现在 updated_at:', returned[0].updated_at);
  }

  /* 4) 重读 + 校验 */
  console.log('\n=== 重读校验 ===');
  const r3 = await fetch(URL + '?key=eq.state&select=updated_at,value', {headers:HEAD_GET});
  const arr2 = await r3.json();
  const finalV = arr2[0].value;
  const newUpdatedAt = arr2[0].updated_at;

  let residual = 0;
  const walk = (obj, path) => {
    Object.keys(obj||{}).forEach(k => {
      const val = obj[k];
      if (typeof val === 'string' && RISK.test(val)) {
        console.log('  ⚠️ 残留: ' + path + '.' + k + ' = ' + JSON.stringify(val).slice(0,60));
        residual++;
      } else if (Array.isArray(val)) {
        val.forEach((x, j) => typeof x === 'object' && x && walk(x, path+'['+j+']'));
      } else if (typeof val === 'object' && val) {
        walk(val, path+'.'+k);
      }
    });
  };
  ['staff','leave','content','handovers','notifications','matchups','highlights']
    .forEach(k => finalV[k] && walk(finalV[k], 'v.'+k));

  console.log('\n=== 结果 ===');
  console.log('  清理前 updated_at:', originalRow.updated_at);
  console.log('  清理后 updated_at:', newUpdatedAt);
  console.log('  残留 payload 数:', residual, residual === 0 ? '✅ 全部清理' : '❌ 仍有残留');
})();
