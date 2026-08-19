-- =====================================================
-- VCT 运营中台 · Supabase 数据库初始化
-- 在 Supabase Dashboard > SQL Editor 中执行此脚本
-- =====================================================

-- 创建 key-value 存储表
CREATE TABLE IF NOT EXISTS kv_store (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 启用行级安全（RLS）
ALTER TABLE kv_store ENABLE ROW LEVEL SECURITY;

-- 允许匿名用户（anon role）读写
-- 这是内部团队工具，anon key 仅在团队内共享
CREATE POLICY "Allow anon read"  ON kv_store FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert" ON kv_store FOR INSERT  TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON kv_store FOR UPDATE  TO anon USING (true);
CREATE POLICY "Allow anon delete" ON kv_store FOR DELETE  TO anon USING (true);
