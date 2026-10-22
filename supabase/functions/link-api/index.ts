import { z } from 'npm:zod@3.25.76'
import { db,handler,ownerAuth,clientAuth,checked,ApiError,jsonBody } from '../_shared/http.ts'
import { safeFetch } from '../_shared/network.ts'
import { canonicalLink,htmlMetadata,feedLinks,platformLinks } from '../_shared/links.ts'
const item=z.object({url:z.string().max(2000),title:z.string().max(500).default(''),reason:z.string().max(1000).default(''),tags:z.array(z.string().min(1).max(40)).max(10).default([]),category:z.enum(['科技','AI','财经','社会','人文','艺术']).default('科技')}).strict()
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('submit'),items:z.array(item).min(1).max(20)}).strict(),
 z.object({action:z.literal('extract'),id:z.string().uuid()}).strict(),
 z.object({action:z.literal('archive'),id:z.string().uuid()}).strict(),
 z.object({action:z.literal('attach'),id:z.string().uuid(),post_id:z.string().uuid()}).strict(),
 z.object({action:z.literal('status'),ids:z.array(z.string().uuid()).min(1).max(20)}).strict(),
 z.object({action:z.literal('collect')}).strict(),
 z.object({action:z.literal('process-link')}).strict(),
 z.object({action:z.literal('set-discovery'),enabled:z.boolean()}).strict()
])
async function insertLink(row:Record<string,unknown>){
 const result=checked(await db.from('link_items').upsert(row,{onConflict:'owner_id,canonical_url',ignoreDuplicates:true}).select('id,stage'))
 if(result.data?.length)return {...result.data[0],duplicate:false}
 const found=checked(await db.from('link_items').select('id,stage').eq('owner_id',row.owner_id).eq('canonical_url',row.canonical_url).single()).data!
 return {...found,duplicate:true}
}
Deno.serve(handler('POST',async(req,raw)=>{
 const parsed=schema.safeParse(jsonBody(raw));if(!parsed.success)throw new ApiError(422,'validation_failed');const body=parsed.data
 const agent=(req.headers.get('authorization')||'').startsWith('Bearer tsw.');let client:any=null;let owner:string
 if(agent){if(!['submit','status','collect','process-link'].includes(body.action))throw new ApiError(403,'owner_required');client=await clientAuth(req,raw,['collect','process-link'].includes(body.action)?'collect':'links');owner=checked(await db.from('profiles').select('id').single()).data!.id}
 else owner=(await ownerAuth(req)).id
 if(body.action==='submit'){
  // Validate the entire batch before any inserts. Caller text is unverified material.
  const rows=body.items.map(i=>({...i,canonical_url:canonicalLink(i.url)}));const results=[]
  for(const i of rows)results.push(await insertLink({owner_id:owner,client_id:client?.id||null,canonical_url:i.canonical_url,title:i.title,reason:i.reason,tags:i.tags,category:i.category,origin:agent?'agent':'owner'}))
  return {ok:true,items:results,message:'已存入私人收件箱；尚未核验或发布'}
 }
 if(body.action==='status'){
  let query=db.from('link_items').select('id,stage,error_code,post_id,updated_at').in('id',body.ids).eq('owner_id',owner);if(client)query=query.eq('client_id',client.id)
  return {items:checked(await query).data}
 }
 if(body.action==='set-discovery'){const current=checked(await db.from('settings').select('value').eq('key','discovery').single()).data!.value;checked(await db.from('settings').update({value:{...current,enabled:body.enabled,mode:'original_briefs',max_per_source:15}}).eq('key','discovery'));return {ok:true}}
 if(body.action==='collect'){
  const config=checked(await db.from('settings').select('value').eq('key','discovery').single()).data!.value
  if(!config.enabled)return {skipped:true,reason:'discovery_paused'}
  const slot=new Date().toISOString().slice(0,13);const run=checked(await db.rpc('reserve_link_collection',{p_slot:slot})).data
  if(!run)return {skipped:true,reason:'already_collected_or_running'}
  let count=0;const errors:{source_id:string;code:string}[]=[]
  try{
   // Small bounded source set fits the hosted runtime. Older sources run first.
   const sources=checked(await db.from('news_sources').select('*').eq('enabled',true).order('last_fetched_at',{ascending:true,nullsFirst:true}).limit(3)).data||[]
   if(!sources.length)errors.push({source_id:'none',code:'no_enabled_sources'})
   for(const source of sources){try{
    let url=source.url;const u=new URL(url)
    if(source.api_adapter==='github'){if(u.hostname!=='api.github.com'||u.pathname!=='/search/repositories')throw new ApiError(422,'unsupported_endpoint');if(!u.search)url+='?q=topic:llm+stars:>50&sort=stars&order=desc&per_page=15'}
    else if(source.api_adapter==='huggingface'){if(u.hostname!=='huggingface.co'||u.pathname!=='/api/models')throw new ApiError(422,'unsupported_endpoint');if(!u.search)url+='?sort=trendingScore&direction=-1&limit=15&full=true'}
    else if(source.source_type!=='rss')throw new ApiError(422,'unsupported_free_source')
    const response=await safeFetch(url,[u.hostname],1200000)
    const items=source.source_type==='rss'?feedLinks(response.body,source):platformLinks(JSON.parse(response.body),source)
    for(const i of items){const result=await insertLink({...i,owner_id:owner,source_id:source.id,source_name:source.name,category:source.category,origin:'collector',stage:'extracted',observed_at:new Date().toISOString()});if(result.duplicate)checked(await db.from('link_items').update({...i,observed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',result.id).eq('origin','collector').neq('stage','archived'));else count++}
    checked(await db.from('news_sources').update({last_fetched_at:new Date().toISOString(),last_error:null}).eq('id',source.id))
   }catch(e){const code=e instanceof ApiError?e.code:'source_fetch_failed';errors.push({source_id:source.id,code});checked(await db.from('news_sources').update({last_error:code,last_fetched_at:new Date().toISOString()}).eq('id',source.id))}}
   checked(await db.from('collection_runs').update({status:errors.length?'failed':'succeeded',count,errors,finished_at:new Date().toISOString()}).eq('id',run))
   return {ok:!errors.length,run_id:run,count,errors,mode:'original_briefs'}
  }catch(e){checked(await db.from('collection_runs').update({status:'failed',errors:['collection_failed'],finished_at:new Date().toISOString()}).eq('id',run));throw e}
 }
 let row:any;if(body.action==='process-link'){row=checked(await db.rpc('claim_link_item',{p_id:null})).data?.[0];if(!row)return {idle:true}}else{row=checked(await db.from('link_items').select('*').eq('id',body.id).eq('owner_id',owner).single()).data!}
 if(body.action==='archive'){checked(await db.from('link_items').update({stage:'archived',processing_until:null,updated_at:new Date().toISOString()}).eq('id',row.id));return {ok:true}}
 if(body.action==='attach'){const post=checked(await db.from('posts').select('id').eq('id',body.post_id).eq('owner_id',owner).single()).data; if(!post)throw new ApiError(404,'post_not_found');checked(await db.from('link_items').update({stage:'drafted',post_id:post.id,updated_at:new Date().toISOString()}).eq('id',row.id));return {ok:true}}
 if(body.action==='extract'){row=checked(await db.rpc('claim_link_item',{p_id:row.id})).data?.[0];if(!row)throw new ApiError(409,'link_already_processed_or_busy')}
 const host=new URL(row.canonical_url).hostname
 const sources=checked(await db.from('news_sources').select('*').eq('enabled',true)).data||[]
 const source=sources.find(s=>[new URL(s.url).hostname,...(s.content_hosts||[])].includes(host))
 if(!source){checked(await db.from('link_items').update({stage:'needs_source',processing_until:null,error_code:'source_not_enabled',updated_at:new Date().toISOString()}).eq('id',row.id).eq('stage','processing'));return {ok:false,error:'source_not_enabled'}}
 try{
  const page=await safeFetch(row.canonical_url,[host],750000);if(!page.contentType.includes('text/html'))throw new ApiError(422,'html_page_required')
  const metadata=htmlMetadata(page.body);if(!metadata.title)throw new ApiError(422,'page_metadata_missing')
  checked(await db.from('link_items').update({...metadata,source_published_at:metadata.source_published_at||row.source_published_at,excerpt:metadata.excerpt||row.excerpt,title:row.title||metadata.title,metadata:{...metadata.metadata,original_title:metadata.title},source_id:source.id,source_name:source.name,stage:row.post_id?'drafted':'extracted',processing_until:null,error_code:null,updated_at:new Date().toISOString()}).eq('id',row.id).eq('stage','processing'))
  return {ok:true,stage:'extracted',message:'已提取网页元信息；未生成中文解读，候选图片未导入'}
 }catch(e){const code=e instanceof ApiError?e.code:'metadata_fetch_failed';checked(await db.from('link_items').update({stage:'failed',processing_until:null,error_code:code,updated_at:new Date().toISOString()}).eq('id',row.id).eq('stage','processing'));return {ok:false,error:code}}
}))
