-- Keep a connection's submission identity stable while rotating both tokens.
-- Otherwise refresh would hide that connection's previous jobs and attachments.
create or replace function public.oauth_refresh(p_client uuid,p_refresh_hash text,p_access_hash text,p_next_refresh_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare g private.oauth_grants;begin
 select * into g from private.oauth_grants where client_id=p_client and refresh_hash=p_refresh_hash for update;
 if not found or g.expires_at<now() or not exists(select 1 from public.api_clients where id=g.access_client_id and active) then return null;end if;
 update public.api_clients set token_hash=p_access_hash,expires_at=now()+interval '1 hour' where id=g.access_client_id;
 update private.oauth_grants set refresh_hash=p_next_refresh_hash where id=g.id;
 return jsonb_build_object('access_id',g.access_client_id,'grant_id',g.id);
end $$;
revoke all on function public.oauth_refresh(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.oauth_refresh(uuid,text,text,text) to service_role;
