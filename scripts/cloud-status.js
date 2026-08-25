const URL='https://woutedgxmovxjnrfylpr.supabase.co/rest/v1/kv_store?key=eq.state&select=updated_at,value';
const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvdXRlZGd4bW92eGpucmZ5bHByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMzk5MTIsImV4cCI6MjEwMjcxNTkxMn0.NfmGbkuWHHnEJ6vZ4Zy7IFdFY4Z6hF_AlZOud2SrAac';
fetch(URL,{headers:{apikey:KEY,Authorization:'Bearer '+KEY}}).then(r=>r.json()).then(arr=>{
  const row=arr[0];
  const v=row.value;
  console.log('=== 云端 metadata ===');
  console.log('updated_at (UTC):', row.updated_at);
  console.log('updated_at (BJT):', new Date(row.updated_at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}));
  console.log('seq:', v.seq, '/ lastSync (BJT):', v.lastSync, new Date(v.lastSync||0).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}));
  console.log('remoteRev:', v.remoteRev, '/ currentUser:', v.user);
  console.log('=== 顶层字段 ===');
  Object.keys(v).forEach(k=>{
    const val=v[k];
    const cnt=Array.isArray(val)?val.length:(typeof val==='object'&&val?Object.keys(val).length:'scalar');
    console.log('  ',k,':',typeof val==='object'?'['+cnt+']':(typeof val==='string'?val.slice(0,30):val));
  });
  console.log('=== staff ===');
  (v.staff||[]).forEach(s=>console.log('  ',s.id,s.name,s.role,s.status,'user='+s.username));

  // 危险载荷扫描：所有用户输入字符串字段
  const scanField=(obj,name,path)=>{
    Object.keys(obj||{}).forEach(k=>{
      const val=obj[k];
      if(typeof val==='string' && /<|>|onerror=|onload=|javascript:/i.test(val)){
        console.log('  ⚠️ '+path+'.'+k+' =', JSON.stringify(val).slice(0,100));
      }else if(Array.isArray(val)){
        val.forEach((x,i)=>typeof x==='object' && scanField(x,name,path+'['+i+']'));
      }else if(typeof val==='object' && val){
        scanField(val,name,path+'.'+k);
      }
    });
  };
  console.log('=== 危险载荷扫描（< / > / onerror / javascript） ===');
  ['leave','content','handovers','highlights','notifications','matchups'].forEach(k=>{
    if(v[k]){console.log('--- v.'+k+' ---'); scanField(v[k],k,'v.'+k);}
  });
});
