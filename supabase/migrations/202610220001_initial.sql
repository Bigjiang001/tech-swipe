-- Single owner. Bootstrap the owner in SQL Console; never from browser metadata.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.app_owner(singleton boolean primary key default true check(singleton), user_id uuid not null unique references auth.users(id));
create or replace function public.is_owner() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from private.app_owner where user_id=(select auth.uid()));
$$;
revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to authenticated, service_role;
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade, display_name text not null default '私人空间所有者', created_at timestamptz not null default now());
create table public.news_sources(id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 120),url text not null unique check(url ~ '^https://'),category text not null check(category in('科技','AI','财经','社会','人文','艺术')),enabled boolean not null default false, source_type text not null default 'rss' check(source_type in('rss','api')), official boolean not null default false, license_note text not null check(length(license_note)>0), last_fetched_at timestamptz,last_error text, created_at timestamptz not null default now());
create table public.news_clusters(id uuid primary key default gen_random_uuid(),event_key text not null unique,title text not null,created_at timestamptz not null default now());
create table public.raw_news(id uuid primary key default gen_random_uuid(),source_id uuid references public.news_sources(id) on delete set null,cluster_id uuid references public.news_clusters(id) on delete set null,url text not null unique,title text not null,source_name text not null,source_published_at timestamptz not null,excerpt text not null check(length(excerpt)<=6000),category text not null,created_at timestamptz not null default now());
create table public.posts(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id),cluster_id uuid references public.news_clusters(id) on delete set null,external_id text unique,idempotency_key text unique,title text not null check(length(title) between 1 and 180),category text not null check(category in('科技','AI','财经','社会','人文','艺术')),short_summary text not null default '' check(length(short_summary)<=500),medium_summary text not null default '' check(length(medium_summary)<=1500),full_content text not null default '' check(length(full_content)<=15000),key_points jsonb not null default '[]' check(jsonb_typeof(key_points)='array' and jsonb_array_length(key_points)<=5),tags text[] not null default '{}',source_name text not null,source_url text not null default '' check(source_url='' or source_url ~ '^https://'),source_published_at timestamptz not null,event_time timestamptz,generated_at timestamptz not null default now(),published_at timestamptz,planned_publish_at timestamptz,image_path text,image_attribution text not null default '',is_ai_generated_image boolean not null default false,verification_status text not null default 'pending' check(verification_status in('pending','verified','rejected')),verification_details jsonb not null default '{}',status text not null default 'draft' check(status in('draft','queued','published')),pinned boolean not null default false,origin text not null default 'manual' check(origin in('manual','agent')),submitted_by text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(), check(status<>'published' or published_at is not null));
create index posts_feed on public.posts(status,pinned desc,published_at desc);
create index posts_category on public.posts(category,published_at desc);
create index posts_search on public.posts using gin(to_tsvector('simple',title||' '||short_summary));
create table public.post_sources(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.posts(id) on delete cascade,name text not null,url text not null check(url ~ '^https://'),published_at timestamptz,unique(post_id,url));
create table public.media_assets(id uuid primary key default gen_random_uuid(),post_id uuid references public.posts(id) on delete cascade,storage_path text not null unique,attribution text not null,license text not null,ai_generated boolean not null default false,created_at timestamptz not null default now());
create table public.likes(user_id uuid not null references public.profiles(id) on delete cascade,post_id uuid not null references public.posts(id) on delete cascade,created_at timestamptz not null default now(),primary key(user_id,post_id));
create table public.bookmarks(like public.likes including all);
alter table public.bookmarks add foreign key(user_id) references public.profiles(id) on delete cascade;
alter table public.bookmarks add foreign key(post_id) references public.posts(id) on delete cascade;
create table public.comments(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,post_id uuid not null references public.posts(id) on delete cascade,body text not null check(length(body) between 1 and 5000),created_at timestamptz not null default now());
create index comments_post on public.comments(post_id,created_at);
create table public.follows(user_id uuid not null references public.profiles(id) on delete cascade,kind text not null check(kind in('category','source','keyword')),value text not null check(length(value) between 1 and 120),created_at timestamptz not null default now(),primary key(user_id,kind,value));
create table public.reading_history(like public.likes including all);
alter table public.reading_history add foreign key(user_id) references public.profiles(id) on delete cascade;
alter table public.reading_history add foreign key(post_id) references public.posts(id) on delete cascade;
create table public.settings(key text primary key,value jsonb not null,updated_at timestamptz not null default now());
insert into public.settings(key,value) values('publishing','{"timezone":"Asia/Tokyo","daily_target":20,"auto_publish":false,"agent_enabled":false}');
create table public.api_clients(id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 80),token_hash text not null unique,scopes text[] not null default array['ingest','status'],active boolean not null default true,expires_at timestamptz not null default(now()+interval '90 days'),created_at timestamptz not null default now());
create table public.agent_jobs(id uuid primary key default gen_random_uuid(),client_id uuid references public.api_clients(id),kind text not null,status text not null default 'pending' check(status in('pending','running','succeeded','failed')),idempotency_key text unique,payload_hash text,payload jsonb not null default '{}',result jsonb,error text,attempts integer not null default 0,lease_until timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index jobs_pending on public.agent_jobs(status,kind,created_at);
create table public.agent_runs(id uuid primary key default gen_random_uuid(),job_id uuid references public.agent_jobs(id),status text not null,model text,error text,duration_ms integer,input_tokens integer not null default 0,output_tokens integer not null default 0,created_at timestamptz not null default now());
create table public.publishing_batches(id uuid primary key default gen_random_uuid(),publish_date date not null unique,timezone text not null,planned_at timestamptz not null,actual_at timestamptz not null default now(),post_count integer not null check(post_count between 0 and 50),post_ids uuid[] not null default '{}');
create table public.submission_logs(id uuid primary key default gen_random_uuid(),client_id uuid references public.api_clients(id),job_id uuid references public.agent_jobs(id),status text not null,post_count integer not null default 0,error_code text,created_at timestamptz not null default now());
create index submissions_recent on public.submission_logs(client_id,created_at desc);
create table public.admin_audit_logs(id uuid primary key default gen_random_uuid(),actor_id uuid references auth.users(id),action text not null,target_id text,details jsonb not null default '{}',created_at timestamptz not null default now());
-- Nonces are persistent and atomic across Edge Function instances.
create table private.api_requests(client_id uuid not null references public.api_clients(id) on delete cascade,nonce text not null,created_at timestamptz not null default now(),primary key(client_id,nonce));
create index requests_recent on private.api_requests(client_id,created_at desc);

-- Explicit grants AND RLS. Operational tables are read-only to the browser.
do $$ declare t text; begin
 foreach t in array array['profiles','news_sources','raw_news','news_clusters','posts','post_sources','media_assets','likes','bookmarks','comments','follows','reading_history','agent_runs','agent_jobs','publishing_batches','api_clients','submission_logs','admin_audit_logs','settings'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  if t<>'api_clients' then
   execute format('grant select on public.%I to authenticated',t);
   execute format('create policy owner_read on public.%I for select to authenticated using ((select public.is_owner()))',t);
  end if;
 end loop;
 foreach t in array array['posts','likes','bookmarks','comments','follows','reading_history'] loop
  execute format('grant insert,update,delete on public.%I to authenticated',t);
  execute format('create policy owner_write on public.%I for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()) and %I=(select auth.uid()))',t,case when t='posts' then 'owner_id' else 'user_id' end);
 end loop;
end $$;
grant select(id,name,scopes,active,expires_at,created_at) on public.api_clients to authenticated;
create policy owner_client_metadata on public.api_clients for select to authenticated using((select public.is_owner()));
grant update(value) on public.settings to authenticated;
create policy owner_settings on public.settings for update to authenticated using((select public.is_owner()) and key='publishing') with check((select public.is_owner()) and key='publishing');

create or replace function private.protect_post() returns trigger language plpgsql set search_path='' as $$
begin
 new.updated_at=now();
 if current_user='authenticated' then
  if new.origin<>'manual' and (tg_op='INSERT' or new.origin<>old.origin or new.verification_status<>old.verification_status or new.verification_details<>old.verification_details) then raise exception 'server_verification_required'; end if;
  if tg_op='UPDATE' and old.origin='agent' and new.origin<>'agent' then raise exception 'origin_immutable'; end if;
  if tg_op='UPDATE' and old.origin='agent' and (new.title,new.short_summary,new.medium_summary,new.full_content,new.source_url,new.source_published_at,new.key_points) is distinct from (old.title,old.short_summary,old.medium_summary,old.full_content,old.source_url,old.source_published_at,old.key_points) then new.verification_status='pending';new.status='draft';new.published_at=null;end if;
 end if;
 if new.origin='agent' and new.status in('queued','published') and new.verification_status<>'verified' then raise exception 'unverified_content'; end if;
 if new.status='published' and new.origin='agent' and new.source_published_at<now()-interval '48 hours' and (tg_op='INSERT' or old.status<>'published') then raise exception 'stale_news'; end if;
 return new;
end $$;
create trigger protect_post before insert or update on public.posts for each row execute function private.protect_post();
create or replace function private.validate_settings() returns trigger language plpgsql set search_path='' as $$
begin
 if new.key='publishing' and (coalesce(new.value->>'timezone','') not in('Asia/Tokyo','Asia/Shanghai') or jsonb_typeof(new.value->'daily_target') is distinct from 'number' or coalesce((new.value->>'daily_target')::numeric,0) not between 1 and 50 or (new.value->>'daily_target')::numeric<>trunc((new.value->>'daily_target')::numeric) or jsonb_typeof(new.value->'auto_publish') is distinct from 'boolean' or jsonb_typeof(new.value->'agent_enabled') is distinct from 'boolean') then raise exception 'invalid_settings';end if;
 new.updated_at=now();return new;
end $$;
create trigger validate_settings before update on public.settings for each row execute function private.validate_settings();

-- All RPCs below are service-role only; Edge Functions implement scoped authorization.
create or replace function public.reserve_request(p_client uuid,p_nonce text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.api_clients where id=p_client and active and expires_at>now() for update;
 if not found then raise exception 'invalid_client';end if;
 delete from private.api_requests where created_at<now()-interval '10 minutes';
 if (select count(*) from private.api_requests where client_id=p_client and created_at>now()-interval '1 minute')>=60 then raise exception 'rate_limited';end if;
 insert into private.api_requests(client_id,nonce) values(p_client,p_nonce);
end $$;
create or replace function public.accept_submission(p_client uuid,p_key text,p_hash text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.agent_jobs;begin
 perform pg_advisory_xact_lock(hashtext(p_key));
 select * into j from public.agent_jobs where idempotency_key=p_key;
 if found then
  if j.client_id<>p_client or j.payload_hash<>p_hash then raise exception 'idempotency_conflict';end if;
  return jsonb_build_object('job_id',j.id,'status',j.status,'duplicate',true);
 end if;
 insert into public.agent_jobs(client_id,kind,idempotency_key,payload_hash,payload) values(p_client,'ingest',p_key,p_hash,p_payload) returning * into j;
 insert into public.submission_logs(client_id,job_id,status,post_count) values(p_client,j.id,'accepted',jsonb_array_length(p_payload->'posts'));
 return jsonb_build_object('job_id',j.id,'status','pending','duplicate',false);
end $$;
create or replace function public.claim_job(p_id uuid default null) returns setof public.agent_jobs language plpgsql security definer set search_path='' as $$
begin
 return query update public.agent_jobs set status='running',attempts=attempts+1,lease_until=now()+interval '10 minutes',updated_at=now() where id=(select id from public.agent_jobs where kind='ingest' and (p_id is null or id=p_id) and (status='pending' or(status='running' and lease_until<now())) and attempts<5 order by created_at for update skip locked limit 1) returning *;
end $$;
-- One transaction: lock, choose eligible rows, create batch, publish all at once.
create or replace function public.publish_daily(p_manual boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb;tz text;local_now timestamp;d date;planned timestamptz;ids uuid[];batch public.publishing_batches;begin
 perform pg_advisory_xact_lock(7338812);
 select value into s from public.settings where key='publishing' for update;
 tz=s->>'timezone';local_now=now() at time zone tz;d=local_now::date;planned=(d+time '08:00') at time zone tz;
 select * into batch from public.publishing_batches where publish_date=d;
 if found then return jsonb_build_object('duplicate',true,'batch_id',batch.id,'post_count',batch.post_count,'planned_at',batch.planned_at,'actual_at',batch.actual_at);end if;
 if not p_manual and(not (s->>'auto_publish')::boolean or not (s->>'agent_enabled')::boolean or local_now::time<time '08:00') then return jsonb_build_object('skipped',true,'reason','not_due_or_paused');end if;
 if exists(select 1 from public.agent_jobs where kind='prepare' and status='running' and lease_until>now()) then return jsonb_build_object('skipped',true,'reason','preparation_in_progress');end if;
 -- Never pre-publish, even when called manually. Empty queues do not consume the day's batch.
 if local_now::time<time '08:00' then return jsonb_build_object('skipped',true,'reason','before_0800');end if;
 select array_agg(id) into ids from(select id from public.posts where status='queued' and verification_status='verified' and origin='agent' and source_published_at>=now()-interval '48 hours' and source_published_at<=now() and (planned_publish_at is null or planned_publish_at<=now()) order by pinned desc,source_published_at desc limit (s->>'daily_target')::integer for update) eligible;
 if ids is null then return jsonb_build_object('skipped',true,'reason','no_verified_posts');end if;
 insert into public.publishing_batches(publish_date,timezone,planned_at,post_count,post_ids) values(d,tz,planned,cardinality(ids),ids) returning * into batch;
 update public.posts set status='published',planned_publish_at=planned,published_at=batch.actual_at where id=any(ids);
 insert into public.admin_audit_logs(action,details) values('publish_daily',jsonb_build_object('batch_id',batch.id,'count',batch.post_count));
 return jsonb_build_object('batch_id',batch.id,'post_count',batch.post_count,'planned_at',batch.planned_at,'actual_at',batch.actual_at,'duplicate',false);
end $$;
do $$ declare signature text;begin
 foreach signature in array array['public.reserve_request(uuid,text)','public.accept_submission(uuid,text,text,jsonb)','public.claim_job(uuid)','public.publish_daily(boolean)'] loop
  execute 'revoke all on function '||signature||' from public, anon, authenticated';
  execute 'grant execute on function '||signature||' to service_role';
 end loop;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('private-media','private-media',false,8388608,array['image/jpeg','image/png','image/webp','image/svg+xml']) on conflict(id) do update set public=false;
create policy owner_media_read on storage.objects for select to authenticated using(bucket_id='private-media' and (select public.is_owner()));
create policy owner_media_insert on storage.objects for insert to authenticated with check(bucket_id='private-media' and (select public.is_owner()) and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy owner_media_delete on storage.objects for delete to authenticated using(bucket_id='private-media' and (select public.is_owner()));
