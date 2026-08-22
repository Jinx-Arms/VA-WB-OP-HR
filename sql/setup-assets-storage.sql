-- =====================================================
-- 图形工厂素材存储初始化（Supabase SQL Editor 执行）
-- 作用：创建 assets bucket 并放开 anon 的读写策略，
--      使前端 js/assets.js 的 Storage REST 上传/读取可用。
-- 注意：内网团队工具，anon key 团队内共享（与 kv_store 策略一致）。
-- =====================================================

-- 1) 创建 bucket（公有读，便于公开 URL 直链访问素材）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assets',
  'assets',
  true,
  10485760,                                   -- 10MB 上限
  array['image/png','image/jpeg','image/webp','font/ttf','font/otf','font/woff','font/woff2']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/png','image/jpeg','image/webp','font/ttf','font/otf','font/woff','font/woff2'];

-- 2) 公开读（任何人可读取素材 URL）
drop policy if exists "assets public read" on storage.objects;
create policy "assets public read"
  on storage.objects for select
  using ( bucket_id = 'assets' );

-- 3) 登录用户可写（insert/update/delete）
--    与现有 kv_store 约定一致：依赖 anon key 共享，未做逐用户隔离。
drop policy if exists "assets anon write" on storage.objects;
create policy "assets anon write"
  on storage.objects for insert
  with check ( bucket_id = 'assets' );

drop policy if exists "assets anon update" on storage.objects;
create policy "assets anon update"
  on storage.objects for update
  using ( bucket_id = 'assets' )
  with check ( bucket_id = 'assets' );

drop policy if exists "assets anon delete" on storage.objects;
create policy "assets anon delete"
  on storage.objects for delete
  using ( bucket_id = 'assets' );
