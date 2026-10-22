-- Install after link-api is deployed. The caller configures techswipe_api_url in Vault.
-- Secret generation and rotation stay inside Postgres; no token literal is committed.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create or replace function private.cron_collect_links(p_action text) returns bigint language plpgsql security definer set search_path='' as $$
declare token text;secret text;client uuid;v_id uuid;base text;stamp text;nonce text;body jsonb;canonical text;signature text;request bigint;begin
 if p_action not in('collect','process-link') then raise exception 'invalid_cron_action';end if;
 body=jsonb_build_object('action',p_action);
 if p_action='process-link' and not exists(select 1 from public.link_items where stage='saved' or(stage='processing' and processing_until<now())) then return null;end if;
 if not coalesce((select (value->>'enabled')::boolean from public.settings where key='discovery'),false) then return null;end if;
 select decrypted_secret into base from vault.decrypted_secrets where name='techswipe_api_url';
 if base is null then raise exception 'link_cron_base_not_configured';end if;
 select id,decrypted_secret into v_id,token from vault.decrypted_secrets where name='techswipe_collect_token';
 client=nullif(split_part(coalesce(token,''),'.',2),'')::uuid;
 if token is null or not exists(select 1 from public.api_clients where id=client and active and expires_at>now()+interval '1 day') then
  if client is not null then update public.api_clients set active=false where id=client;end if;
  secret=encode(extensions.gen_random_bytes(32),'hex');client=gen_random_uuid();token='tsw.'||client::text||'.'||secret;
  insert into public.api_clients(id,name,token_hash,scopes) values(client,'后台基础快讯采集（自动轮换）',encode(extensions.digest(secret,'sha256'),'hex'),array['collect']);
  if v_id is null then perform vault.create_secret(token,'techswipe_collect_token');else perform vault.update_secret(v_id,token);end if;
 end if;
 secret=split_part(token,'.',3);stamp=floor(extract(epoch from now()))::bigint::text;nonce=gen_random_uuid()::text;
 canonical='POST'||chr(10)||'/functions/v1/link-api'||chr(10)||stamp||chr(10)||nonce||chr(10)||encode(extensions.digest(body::text,'sha256'),'hex');
 signature=encode(extensions.hmac(canonical,secret,'sha256'),'hex');
 select net.http_post(url:=rtrim(base,'/')||'/link-api',body:=body,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token,'X-TS-Timestamp',stamp,'X-TS-Nonce',nonce,'X-TS-Signature',signature),timeout_milliseconds:=60000) into request;
 return request;
end $$;
revoke all on function private.cron_collect_links(text) from public,anon,authenticated;
create or replace function private.cron_collect_links() returns bigint language sql security definer set search_path='' as $$select private.cron_collect_links('collect')$$;
revoke all on function private.cron_collect_links() from public,anon,authenticated;
select cron.schedule('techswipe-link-metadata','*/2 * * * *',$$select private.cron_collect_links('process-link')$$);
-- Named schedule updates in place if setup runs again. UTC hourly, timezone independent.
select cron.schedule('techswipe-link-collector','20 * * * *','select private.cron_collect_links()');
-- Pause in the app; or: select cron.unschedule('techswipe-link-collector');
