create extension if not exists pg_trgm with schema extensions;

create table public.shomi_answer_cache (
  id uuid primary key default gen_random_uuid(),
  language text not null check (language in ('ko','en')),
  question text not null,
  question_norm text not null,
  answer text not null,
  hit_count integer not null default 0,
  created_at timestamptz not null default now(),
  last_hit_at timestamptz,
  unique (language, question_norm)
);
alter table public.shomi_answer_cache enable row level security;
create policy "admins read shomi cache" on public.shomi_answer_cache for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admins delete shomi cache" on public.shomi_answer_cache for delete to authenticated using (public.has_role(auth.uid(),'admin'));
grant select, delete on public.shomi_answer_cache to authenticated;
grant all on public.shomi_answer_cache to service_role;
create index shomi_answer_cache_trgm on public.shomi_answer_cache using gin (question_norm extensions.gin_trgm_ops);

create or replace function public.match_shomi_answer(p_language text, p_norm text, p_threshold real default 0.6)
returns table(id uuid, answer text, score real)
language sql stable security definer set search_path = public, extensions
as $$
  select c.id, c.answer, extensions.similarity(c.question_norm, p_norm) as score
  from public.shomi_answer_cache c
  where c.language = p_language and extensions.similarity(c.question_norm, p_norm) >= p_threshold
  order by score desc limit 1;
$$;
revoke all on function public.match_shomi_answer(text,text,real) from public, anon, authenticated;
grant execute on function public.match_shomi_answer(text,text,real) to service_role;