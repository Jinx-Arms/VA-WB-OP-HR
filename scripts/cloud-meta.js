const URL='https://woutedgxmovxjnrfylpr.supabase.co/rest/v1/kv_store?key=eq.state';
const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvdXRlZGd4bW92eGpucmZ5bHByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMzk5MTIsImV4cCI6MjEwMjcxNTkxMn0.NfmGbkuWHHnEJ6vZ4Zy7IFdFY4Z6hF_AlZOud2SrAac';
(async () => {
  const r1 = await fetch(URL + '&select=*', { headers:{apikey:KEY,Authorization:'Bearer '+KEY} });
  const j = await r1.json();
  console.log('row columns:', Object.keys(j[0]||{}).join(','));
  if (j[0]) {
    console.log('created_at:', j[0].created_at, 'updated_at:', j[0].updated_at);
  }
  // 探测 anon 写入权限（不改 value，只查 schema）
  const schema = await fetch('https://woutedgxmovxjnrfylpr.supabase.co/rest/v1/', { headers:{apikey:KEY,Authorization:'Bearer '+KEY} });
  console.log('REST root:', schema.status);
})();
