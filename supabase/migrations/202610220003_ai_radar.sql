alter table public.posts add column content_kind text not null default 'news' check(content_kind in('news','project','model_update'));
alter table public.raw_news add column content_kind text not null default 'news' check(content_kind in('news','project','model_update'));
alter table public.news_sources drop constraint news_sources_api_adapter_check;
alter table public.news_sources add constraint news_sources_api_adapter_check check(api_adapter in('newsapi','github','huggingface'));
alter table public.news_sources add column focus text not null default 'general' check(focus in('general','model_update'));
drop index public.posts_agent_url_unique;
create unique index posts_agent_url_unique on public.posts(source_url) where origin='agent' and content_kind<>'project';
create unique index posts_project_daily_unique on public.posts(source_url,((source_published_at at time zone 'UTC')::date)) where origin='agent' and content_kind='project';
