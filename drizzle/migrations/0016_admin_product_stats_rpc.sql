create or replace function public.admin_product_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total', (select count(*) from public.products_cache where is_active),
    'by_merchant', coalesce((
      select jsonb_object_agg(merchant_id, cnt)
      from (
        select merchant_id, count(*)::bigint as cnt
        from public.products_cache
        where is_active and merchant_id is not null
        group by merchant_id
      ) m
    ), '{}'::jsonb),
    'by_category', coalesce((
      select jsonb_object_agg(category, cnt)
      from (
        select category, count(*)::bigint as cnt
        from public.products_cache
        where is_active and category is not null
        group by category
      ) c
    ), '{}'::jsonb)
  )
  where public.has_role(auth.uid(), 'admin');
$$;

revoke all on function public.admin_product_stats() from public, anon;
grant execute on function public.admin_product_stats() to authenticated;
grant execute on function public.admin_product_stats() to service_role;