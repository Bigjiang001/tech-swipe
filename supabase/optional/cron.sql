-- OPTIONAL. Execute after storing secrets using Supabase Vault in Dashboard.
-- Configure these Vault secret names: techswipe_api_url, techswipe_automation_token.
-- The token needs `publish` scope. Never paste its literal value into committed SQL.
-- GitHub Actions is independently sufficient; cron reduces scheduling latency.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create or replace function private.cron_publish() returns void language plpgsql security definer set search_path='' as $$
declare token text;secret text;base text;target text:='/functions/v1/news-publish-daily';stamp text;nonce text;body text:='{}';canonical text;signature text;begin
 select decrypted_secret into token from vault.decrypted_secrets where name='techswipe_automation_token';
 select decrypted_secret into base from vault.decrypted_secrets where name='techswipe_api_url';
 if token is null or base is null then raise exception 'Cron secrets not configured';end if;
 secret=split_part(token,'.',3);stamp=floor(extract(epoch from now()))::bigint::text;nonce=gen_random_uuid()::text;
 canonical='POST'||chr(10)||target||chr(10)||stamp||chr(10)||nonce||chr(10)||encode(extensions.digest(body,'sha256'),'hex');
 signature=encode(extensions.hmac(canonical,secret,'sha256'),'hex');
 perform net.http_post(url=rtrim(base,'/')||'/news-publish-daily',body=body::jsonb,headers=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token,'X-TS-Timestamp',stamp,'X-TS-Nonce',nonce,'X-TS-Signature',signature));
end $$;
revoke all on function private.cron_publish() from public,anon,authenticated;
-- Every minute; DB publish_daily determines 08:00 in the configured timezone.
select cron.schedule('techswipe-daily-publish','* * * * *','select private.cron_publish()');
-- Pause: select cron.unschedule('techswipe-daily-publish');
