alter table public.link_items drop constraint link_items_stage_check;
alter table public.link_items add constraint link_items_stage_check check(stage in('saved','processing','extracted','needs_source','failed','drafted','archived'));
alter table public.link_items add column processing_until timestamptz;
create or replace function public.claim_link_item(p_id uuid default null) returns setof public.link_items language plpgsql security definer set search_path='' as $$begin
 return query update public.link_items set stage='processing',processing_until=now()+interval '3 minutes',updated_at=now() where id=(select id from public.link_items where ((p_id is null and (stage='saved' or(stage='processing' and processing_until<now()))) or(p_id=id and stage not in('archived','drafted') and(processing_until is null or processing_until<now()))) order by created_at for update skip locked limit 1) returning *;
end $$;
revoke all on function public.claim_link_item(uuid) from public,anon,authenticated;grant execute on function public.claim_link_item(uuid) to service_role;
