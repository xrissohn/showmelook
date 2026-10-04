create table public.shomi_knowledge_files (
  drive_file_id text primary key,
  name text not null,
  mime_type text not null,
  modified_time timestamptz,
  status text not null default 'active' check (status in ('baseline','active','skipped','error')),
  summary text,
  error text,
  updated_at timestamptz not null default now()
);
grant select on public.shomi_knowledge_files to authenticated;
grant all on public.shomi_knowledge_files to service_role;
alter table public.shomi_knowledge_files enable row level security;
create policy "admins read shomi knowledge files" on public.shomi_knowledge_files for select to authenticated using (public.has_role(auth.uid(),'admin'));