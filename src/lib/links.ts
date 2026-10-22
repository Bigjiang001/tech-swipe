import { ref } from 'vue'
import { supabase } from './supabase'
import { useApp } from '../stores/app'
export interface LinkItem {id:string;canonical_url:string;title:string;excerpt:string;reason:string;tags:string[];category:string;origin:'owner'|'agent'|'collector';stage:string;source_name:string;source_published_at:string|null;observed_at:string;error_code:string|null;post_id:string|null;metadata:Record<string,any>}
export const stageLabels:Record<string,string>={saved:'待提取',processing:'正在提取',extracted:'待整理',needs_source:'需要启用来源',failed:'提取失败',drafted:'已关联文章',archived:'已归档'}
export const linkErrors:Record<string,string>={source_not_enabled:'请先在后台添加并启用对应来源。链接已保存，尚未抓取。',source_unavailable:'原文暂时不可访问，请稍后重试。',page_metadata_missing:'页面未提供可提取的标题，请手动整理。',html_page_required:'该地址不是可提取的网页。',no_enabled_sources:'尚未启用信息源。',source_fetch_failed:'来源连接失败，稍后会重试。',metadata_fetch_failed:'暂时无法提取网页元信息。',discovery_paused:'自动采集已暂停。',already_collected_or_running:'本小时已采集，或采集任务正在运行。'}
export function useLinks(){
 const app=useApp(),items=ref<LinkItem[]>([]),runs=ref<any[]>([]),discovery=ref({enabled:false,schedule:'unconfigured'}),busy=ref(false)
 async function load(){if(app.demo)return; if(!supabase)throw new Error('未连接私人后端');const result=await Promise.all([supabase.from('link_items').select('*').order('observed_at',{ascending:false}).limit(200),supabase.from('collection_runs').select('*').order('started_at',{ascending:false}).limit(5),supabase.from('settings').select('value').eq('key','discovery').single()]);for(const r of result)if(r.error)throw r.error;items.value=result[0]!.data as LinkItem[];runs.value=result[1]!.data||[];discovery.value=result[2]!.data?.value as any}
 async function action(action:string,payload:Record<string,unknown>={}){if(app.demo)throw new Error('演示模式不会抓取或上传真实资料，请登录私人空间');if(!supabase)throw new Error('未连接私人后端');const {data,error}=await supabase.functions.invoke('link-api',{body:{action,...payload}});if(error)throw new Error('操作未完成，请检查登录会话或稍后重试');if(data?.error)throw new Error(linkErrors[data.error]||data.error);return data}
 return {items,runs,discovery,busy,load,action}
}
