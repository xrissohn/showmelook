create or replace function public.admin_dna_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total', (select count(*) from public.products_cache where is_active),
    'with_dna', (select count(*) from public.products_cache where is_active and dna_meta is not null),
    'by_target', coalesce((
      select jsonb_object_agg(target, cnt)
      from (
        select dna_meta->>'target' as target, count(*)::bigint as cnt
        from public.products_cache
        where is_active and dna_meta is not null and dna_meta->>'target' is not null
        group by 1
      ) t
    ), '{}'::jsonb),
    'by_slot', coalesce((
      select jsonb_object_agg(slot, cnt)
      from (
        select dna_meta->>'item_slot' as slot, count(*)::bigint as cnt
        from public.products_cache
        where is_active and dna_meta is not null and dna_meta->>'item_slot' is not null
        group by 1
      ) s
    ), '{}'::jsonb),
    'by_concept', coalesce((
      select jsonb_object_agg(concept, cnt)
      from (
        select concept, count(*)::bigint as cnt
        from public.products_cache,
             lateral jsonb_array_elements_text(dna_meta->'concepts') as concept
        where is_active and dna_meta is not null
        group by 1
      ) c
    ), '{}'::jsonb)
  )
  where public.has_role(auth.uid(), 'admin');
$$;

revoke all on function public.admin_dna_stats() from public, anon;
grant execute on function public.admin_dna_stats() to authenticated;
grant execute on function public.admin_dna_stats() to service_role;