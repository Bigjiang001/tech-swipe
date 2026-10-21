alter table public.news_sources add column image_policy text not null default 'illustration' check(image_policy in('illustration','licensed'));
alter table public.news_sources add column image_license text not null default '';
alter table public.news_sources add column image_hosts text[] not null default '{}';
alter table public.news_sources add column content_hosts text[] not null default '{}';
alter table public.news_sources add column api_adapter text check(api_adapter in('newsapi'));
alter table public.news_sources add constraint image_license_required check(image_policy<>'licensed' or(length(image_license)>0 and cardinality(image_hosts)>0));
alter table public.agent_jobs add column lease_token uuid;
create or replace function public.claim_job(p_id uuid default null) returns setof public.agent_jobs language plpgsql security definer set search_path='' as $$
begin
 return query update public.agent_jobs set status='running',attempts=attempts+1,lease_until=now()+interval '3 minutes',lease_token=gen_random_uuid(),updated_at=now() where id=(select id from public.agent_jobs where kind='ingest' and (p_id is null or id=p_id) and (status='pending' or(status='running' and lease_until<now())) and attempts<5 order by created_at for update skip locked limit 1) returning *;
end $$;
create or replace function public.reserve_preparation(p_date date,p_force boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.agent_jobs;s jsonb;d date;begin
 select value into s from public.settings where key='publishing';d=(now() at time zone(s->>'timezone'))::date;
 if p_date<>d then raise exception 'wrong_local_date';end if;
 perform pg_advisory_xact_lock(hashtext('prepare:'||d::text));
 select * into j from public.agent_jobs where idempotency_key='prepare:'||d::text for update;
 if found and(j.status='succeeded' or(j.status='running' and j.lease_until>now())) then return jsonb_build_object('skipped',true,'status',j.status,'job_id',j.id);end if;
 if found then update public.agent_jobs set status='running',attempts=attempts+1,lease_until=now()+interval '35 minutes',updated_at=now() where id=j.id returning * into j;
 else insert into public.agent_jobs(kind,status,idempotency_key,lease_until,attempts) values('prepare','running','prepare:'||d::text,now()+interval '35 minutes',1) returning * into j;end if;
 return jsonb_build_object('job_id',j.id,'skipped',false);
end $$;
revoke all on function public.reserve_preparation(date,boolean) from public,anon,authenticated;
grant execute on function public.reserve_preparation(date,boolean) to service_role;
-- One event URL cannot be inserted twice through different clients / batch IDs.
create unique index posts_agent_url_unique on public.posts(source_url) where origin='agent';
