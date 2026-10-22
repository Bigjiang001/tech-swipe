-- Validate submitted news into private drafts. This does not publish.
-- No call is made when the durable ingest queue is empty.
create or replace function private.cron_process_news() returns bigint language plpgsql security definer set search_path='' as $$
declare token text;secret text;client uuid;v_id uuid;base text;stamp text;nonce text;body jsonb:='{"action":"drain"}';canonical text;signature text;request bigint;begin
 if not exists(select 1 from public.agent_jobs where kind='ingest' and(status='pending' or(status='running' and lease_until<now()))) then return null;end if;
 select decrypted_secret into base from vault.decrypted_secrets where name='techswipe_api_url';if base is null then return null;end if;
 select id,decrypted_secret into v_id,token from vault.decrypted_secrets where name='techswipe_worker_token';client=nullif(split_part(coalesce(token,''),'.',2),'')::uuid;
 if token is null or not exists(select 1 from public.api_clients where id=client and active and expires_at>now()+interval '1 day') then
  if client is not null then update public.api_clients set active=false where id=client;end if;
  secret=encode(extensions.gen_random_bytes(32),'hex');client=gen_random_uuid();token='tsw.'||client::text||'.'||secret;
  insert into public.api_clients(id,name,token_hash,scopes) values(client,'后台投稿处理（自动轮换）',encode(extensions.digest(secret,'sha256'),'hex'),array['worker']);
  if v_id is null then perform vault.create_secret(token,'techswipe_worker_token');else perform vault.update_secret(v_id,token);end if;
 end if;
 secret=split_part(token,'.',3);stamp=floor(extract(epoch from now()))::bigint::text;nonce=gen_random_uuid()::text;
 canonical='POST'||chr(10)||'/functions/v1/news-worker'||chr(10)||stamp||chr(10)||nonce||chr(10)||encode(extensions.digest(body::text,'sha256'),'hex');signature=encode(extensions.hmac(canonical,secret,'sha256'),'hex');
 select net.http_post(url:=rtrim(base,'/')||'/news-worker',body:=body,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token,'X-TS-Timestamp',stamp,'X-TS-Nonce',nonce,'X-TS-Signature',signature),timeout_milliseconds:=90000) into request;return request;
end $$;
revoke all on function private.cron_process_news() from public,anon,authenticated;
select cron.schedule('techswipe-submission-worker','*/2 * * * *','select private.cron_process_news()');
-- Stop processing (does not remove queued submissions):
-- select cron.unschedule('techswipe-submission-worker');
