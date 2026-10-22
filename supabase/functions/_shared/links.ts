import { XMLParser } from 'npm:fast-xml-parser@5.11.2'
import { ApiError } from './http.ts'
import { plainText } from './network.ts'
export function canonicalLink(value:string){
 let u:URL;try{u=new URL(value.trim())}catch{throw new ApiError(422,'invalid_url')}
 if(u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.')||/^[\d.:[\]]+$/.test(u.hostname)||/(^|\.)(localhost|local|internal|lan|test)$/.test(u.hostname))throw new ApiError(422,'public_https_required')
 for(const k of [...u.searchParams.keys()]){if(/api.?key|access.?token|secret|password|signature|authorization/i.test(k))throw new ApiError(422,'credentials_in_url_denied');if(k.startsWith('utm_')||['fbclid','gclid'].includes(k))u.searchParams.delete(k)}
 u.hash='';u.searchParams.sort();u.pathname=u.pathname.replace(/\/$/,'')||'/';return u.toString()
}
export function validDate(value:unknown){if(typeof value!=='string')return null;const t=Date.parse(value);return Number.isFinite(t)&&t<=Date.now()+60000?new Date(t).toISOString():null}
export function htmlMetadata(html:string){
 const metas=[...html.matchAll(/<meta\b[^>]*>/gi)].map(m=>Object.fromEntries([...m[0].matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(a=>[a[1].toLowerCase(),a[2]])))
 const get=(...keys:string[])=>metas.find(m=>keys.includes(m.property||m.name))?.content||''
 return {title:plainText(get('og:title','twitter:title')||html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').slice(0,500),excerpt:plainText(get('description','og:description','twitter:description')).slice(0,1200),source_published_at:validDate(get('article:published_time','date','datePublished')),metadata:{candidate_image:get('og:image'),extraction:'page_metadata_only',limitations:'原文元信息，未生成中文解读，未独立核验；候选图片不代表获准使用'}}
}
const array=(x:any)=>x==null?[]:Array.isArray(x)?x:[x]
const text=(x:any):string=>typeof x==='string'?x:typeof x==='number'?String(x):x?.['#text']||''
export function feedLinks(raw:string,source:any,now=new Date()){
 if(/<!DOCTYPE|<!ENTITY/i.test(raw))throw new ApiError(422,'unsafe_feed')
 const parsed=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',processEntities:false}).parse(raw)
 const entries=array(parsed.rss?.channel?.item||parsed.feed?.entry||parsed['rdf:RDF']?.item)
 if(!entries.length)throw new ApiError(422,'empty_feed')
 const hosts=new Set([new URL(source.url).hostname,...(source.content_hosts||[])])
 return entries.slice(0,80).flatMap((e:any)=>{try{
 const link=typeof e.link==='string'?e.link:array(e.link).find((l:any)=>!l['@_rel']||l['@_rel']==='alternate')?.['@_href'];const url=canonicalLink(link||'');if(!hosts.has(new URL(url).hostname))return []
 const date=validDate(text(e.pubDate||e.published||e.updated||e['dc:date']));if(!date||now.getTime()-Date.parse(date)>48*3600000)return []
 const title=plainText(text(e.title)).slice(0,500);if(!title)return []
 return [{canonical_url:url,title,excerpt:plainText(text(e.description||e.summary)).slice(0,600),source_published_at:date,metadata:{kind:source.focus==='model_update'?'model_update':'news',extraction:'rss_legal_excerpt',limitations:'原文快讯，未生成中文解读，未独立核验'}}]
 }catch{return []}}).slice(0,15)
}
export function platformLinks(data:any,source:any,now=new Date()){
 const github=source.api_adapter==='github';const rows=github?data.items:data;if(!Array.isArray(rows))throw new ApiError(422,'invalid_platform_response')
 return rows.slice(0,15).flatMap((e:any)=>{const name=github?e.full_name:e.id;if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name||''))return [];const metrics=github?{stars:e.stargazers_count,forks:e.forks_count,language:e.language,pushed_at:e.pushed_at}:{downloads:e.downloads,likes:e.likes,last_modified:e.lastModified,pipeline_tag:e.pipeline_tag};return [{canonical_url:github?`https://github.com/${name}`:`https://huggingface.co/${name}`,title:name,excerpt:plainText(String(e.description||'')).slice(0,600),source_published_at:null,metadata:{kind:'project',metrics,observed_at:now.toISOString(),extraction:github?'github_cumulative_stars':'huggingface_trendingScore',limitations:'平台指标快照，不是今日发布；累计 stars、平台下载窗口和喜欢数不等于能力排名'}}]})
}
