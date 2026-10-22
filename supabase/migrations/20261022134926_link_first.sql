-- Link inbox is private source material, never a published news feed.
create table public.link_items(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id),
 client_id uuid references public.api_clients(id),source_id uuid references public.news_sources(id) on delete set null,
 canonical_url text not null check(length(canonical_url)<=2000 and canonical_url ~ '^https://'),
 title text not null default '' check(length(title)<=500),excerpt text not null default '' check(length(excerpt)<=1200),
 reason text not null default '' check(length(reason)<=1000),tags text[] not null default '{}',
 category text not null default '科技' check(category in('科技','AI','财经','社会','人文','艺术')),
 origin text not null check(origin in('owner','agent','collector')),
 stage text not null default 'saved' check(stage in('saved','extracted','needs_source','failed','drafted','archived')),
 source_name text not null default '',source_published_at timestamptz,observed_at timestamptz not null default now(),
 metadata jsonb not null default '{}',error_code text,post_id uuid references public.posts(id) on delete set null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(owner_id,canonical_url)
);
create index link_items_feed on public.link_items(origin,observed_at desc);
create index link_items_stage on public.link_items(stage,created_at desc);
alter table public.link_items enable row level security;
revoke all on public.link_items from public,anon,authenticated;
grant select on public.link_items to authenticated;
grant all on public.link_items to service_role;
create policy owner_links_read on public.link_items for select to authenticated using((select public.is_owner()) and owner_id=(select auth.uid()));
create table public.collection_runs(id uuid primary key default gen_random_uuid(),slot text unique not null,status text not null check(status in('running','succeeded','failed')),count integer not null default 0,errors jsonb not null default '[]',started_at timestamptz not null default now(),finished_at timestamptz);
alter table public.collection_runs enable row level security;
revoke all on public.collection_runs from public,anon,authenticated;
grant select on public.collection_runs to authenticated;grant all on public.collection_runs to service_role;
create policy owner_collection_read on public.collection_runs for select to authenticated using((select public.is_owner()));
insert into public.settings(key,value) values('discovery','{"enabled":true,"mode":"original_briefs","max_per_source":15}') on conflict(key) do nothing;
create or replace function public.reserve_link_collection(p_slot text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;begin
 perform pg_advisory_xact_lock(hashtext('techswipe-link-collection'));
 if exists(select 1 from public.collection_runs where status='running' and started_at>now()-interval '5 minutes') then return null;end if;
 update public.collection_runs set status='failed',finished_at=now(),errors='["worker_timeout"]' where status='running' and started_at<=now()-interval '5 minutes';
 insert into public.collection_runs(slot,status) values(p_slot,'running') on conflict(slot) do update set status='running',started_at=now(),finished_at=null where collection_runs.status='failed' returning id into result;
 return result;
end $$;
revoke all on function public.reserve_link_collection(text) from public,anon,authenticated;
grant execute on function public.reserve_link_collection(text) to service_role;
-- Appended manual images also stay in the existing private bucket.
create table public.post_media(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.posts(id) on delete cascade,owner_id uuid not null references public.profiles(id),storage_path text not null,attribution text not null check(length(attribution) between 1 and 500),position integer not null default 0 check(position between 0 and 5),created_at timestamptz not null default now(),unique(post_id,position));
alter table public.post_media enable row level security;
revoke all on public.post_media from public,anon,authenticated;
grant select,insert,update,delete on public.post_media to authenticated;grant all on public.post_media to service_role;
create policy owner_post_media on public.post_media for all to authenticated using((select public.is_owner()) and owner_id=(select auth.uid())) with check((select public.is_owner()) and owner_id=(select auth.uid()) and split_part(storage_path,'/',1)=(select auth.uid())::text and exists(select 1 from public.posts p where p.id=post_id and p.owner_id=(select auth.uid())));
create table public.audio_briefs(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id),local_date date not null,content_hash text not null,post_ids uuid[] not null,state text not null check(state in('generating','ready','failed')),attempts integer not null default 1,lease_until timestamptz,storage_path text,error_code text,created_at timestamptz not null default now(),unique(local_date,content_hash));
alter table public.audio_briefs enable row level security;
revoke all on public.audio_briefs from public,anon,authenticated;grant select on public.audio_briefs to authenticated;grant all on public.audio_briefs to service_role;
create policy owner_audio_read on public.audio_briefs for select to authenticated using((select public.is_owner()) and owner_id=(select auth.uid()));
create or replace function public.reserve_audio_brief(p_date date,p_hash text,p_ids uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.audio_briefs;owner uuid;begin
 perform pg_advisory_xact_lock(hashtext('techswipe-audio:'||p_date::text));
 select * into r from public.audio_briefs where local_date=p_date and content_hash=p_hash for update;
 if found then
  if r.state='ready' then return jsonb_build_object('id',r.id,'state',r.state,'claimed',false);end if;
  if r.state='generating' and r.lease_until>now() then return jsonb_build_object('id',r.id,'state',r.state,'claimed',false);end if;
  if r.attempts>=3 then raise exception 'audio_retry_limit';end if;
  update public.audio_briefs set state='generating',attempts=attempts+1,lease_until=now()+interval '3 minutes',error_code=null where id=r.id;
  return jsonb_build_object('id',r.id,'state','generating','claimed',true);
 end if;
 if (select count(*) from public.audio_briefs where local_date=p_date)>=2 then raise exception 'audio_daily_limit';end if;
 select user_id into owner from private.app_owner where singleton;
 insert into public.audio_briefs(owner_id,local_date,content_hash,post_ids,state,lease_until) values(owner,p_date,p_hash,p_ids,'generating',now()+interval '3 minutes') returning * into r;
 return jsonb_build_object('id',r.id,'state','generating','claimed',true);
end $$;
revoke all on function public.reserve_audio_brief(date,text,uuid[]) from public,anon,authenticated;grant execute on function public.reserve_audio_brief(date,text,uuid[]) to service_role;

update storage.buckets set file_size_limit=20971520,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/svg+xml','audio/mpeg'] where id='private-media';
-- OAuth credentials and one-use authorization codes are never exposed through PostgREST.
create table private.oauth_clients(id uuid primary key default gen_random_uuid(),name text not null,redirect_uris text[] not null,created_at timestamptz not null default now());
create table private.oauth_codes(code_hash text primary key,client_id uuid not null references private.oauth_clients(id),redirect_uri text not null,challenge text not null,expires_at timestamptz not null default now()+interval '2 minutes');
create table private.oauth_grants(id uuid primary key default gen_random_uuid(),client_id uuid not null references private.oauth_clients(id),access_client_id uuid not null references public.api_clients(id),refresh_hash text not null unique,expires_at timestamptz not null default now()+interval '90 days');
revoke all on all tables in schema private from public,anon,authenticated;
create or replace function public.oauth_client_info(p_id uuid) returns jsonb language sql security definer set search_path='' as $$select jsonb_build_object('id',id,'name',name,'redirect_uris',redirect_uris) from private.oauth_clients where id=p_id$$;
create or replace function public.oauth_register(p_name text,p_redirects text[]) returns uuid language plpgsql security definer set search_path='' as $$declare result uuid;begin
 if(select count(*) from private.oauth_clients where created_at>now()-interval '1 day')>=50 then raise exception 'registration_limit';end if;
 insert into private.oauth_clients(name,redirect_uris) values(p_name,p_redirects) returning id into result;return result;end $$;
create or replace function public.oauth_authorize(p_client uuid,p_redirect text,p_challenge text,p_code_hash text) returns boolean language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from private.oauth_clients where id=p_client and p_redirect=any(redirect_uris)) then return false;end if;
 delete from private.oauth_codes where expires_at<now();insert into private.oauth_codes(code_hash,client_id,redirect_uri,challenge) values(p_code_hash,p_client,p_redirect,p_challenge);return true;end $$;
create or replace function public.oauth_exchange(p_client uuid,p_redirect text,p_challenge text,p_code_hash text,p_access_hash text,p_refresh_hash text) returns jsonb language plpgsql security definer set search_path='' as $$declare c private.oauth_codes;a uuid;g uuid;begin
 select * into c from private.oauth_codes where code_hash=p_code_hash for update;
 if not found or c.expires_at<now() or c.client_id<>p_client or c.redirect_uri<>p_redirect or c.challenge<>p_challenge then return null;end if;
 delete from private.oauth_codes where code_hash=p_code_hash;
 insert into public.api_clients(name,token_hash,scopes,expires_at) values('ChatGPT · 链接与草稿投稿',p_access_hash,array['links','ingest','status'],now()+interval '1 hour') returning id into a;
 insert into private.oauth_grants(client_id,access_client_id,refresh_hash) values(p_client,a,p_refresh_hash) returning id into g;
 return jsonb_build_object('access_id',a,'grant_id',g);end $$;
create or replace function public.oauth_refresh(p_client uuid,p_refresh_hash text,p_access_hash text,p_next_refresh_hash text) returns jsonb language plpgsql security definer set search_path='' as $$declare g private.oauth_grants;a uuid;begin
 select * into g from private.oauth_grants where client_id=p_client and refresh_hash=p_refresh_hash for update;
 if not found or g.expires_at<now() or not exists(select 1 from public.api_clients where id=g.access_client_id and active) then return null;end if;
 update public.api_clients set active=false where id=g.access_client_id;
 insert into public.api_clients(name,token_hash,scopes,expires_at) values('ChatGPT · 链接与草稿投稿',p_access_hash,array['links','ingest','status'],now()+interval '1 hour') returning id into a;
 update private.oauth_grants set access_client_id=a,refresh_hash=p_next_refresh_hash where id=g.id;
 return jsonb_build_object('access_id',a,'grant_id',g.id);end $$;
do $$declare f text;begin foreach f in array array['public.oauth_client_info(uuid)','public.oauth_register(text,text[])','public.oauth_authorize(uuid,text,text,text)','public.oauth_exchange(uuid,text,text,text,text,text)','public.oauth_refresh(uuid,text,text,text)'] loop execute 'revoke all on function '||f||' from public,anon,authenticated';execute 'grant execute on function '||f||' to service_role';end loop;end $$;
create table public.link_attachments(id uuid primary key default gen_random_uuid(),link_id uuid not null references public.link_items(id) on delete cascade,owner_id uuid not null references public.profiles(id),storage_path text not null,content_hash text not null,attribution text not null check(length(attribution) between 1 and 500),is_ai_generated boolean not null default false,created_at timestamptz not null default now(),unique(link_id,content_hash));
alter table public.link_attachments enable row level security;
revoke all on public.link_attachments from public,anon,authenticated;grant select on public.link_attachments to authenticated;grant all on public.link_attachments to service_role;
create policy owner_link_attachments on public.link_attachments for select to authenticated using((select public.is_owner()) and owner_id=(select auth.uid()));

alter table public.post_media add column is_ai_generated boolean not null default false;
create or replace function private.limit_link_attachments() returns trigger language plpgsql set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtext('link-media:'||new.link_id::text));
 if not exists(select 1 from public.link_attachments where link_id=new.link_id and content_hash=new.content_hash) and (select count(*) from public.link_attachments where link_id=new.link_id)>=5 then raise exception 'attachment_limit';end if;
 return new;
end $$;
create trigger limit_link_attachments before insert on public.link_attachments for each row execute function private.limit_link_attachments();

alter table private.oauth_clients enable row level security;
alter table private.oauth_codes enable row level security;
alter table private.oauth_grants enable row level security;
