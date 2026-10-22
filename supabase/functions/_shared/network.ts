import { ApiError,limitedBody } from './http.ts'
export function allowedUrl(value:string,hosts:string[]){let u:URL;try{u=new URL(value)}catch{throw new ApiError(422,'invalid_url')}if(u.protocol!=='https:'||u.username||u.password||u.port||!hosts.includes(u.hostname.toLowerCase())||u.hostname==='localhost'||/^[\d.:\[\]]+$/.test(u.hostname))throw new ApiError(422,'url_not_allowlisted');return u}
export async function safeResponse(value:string,hosts:string[]){
 let target=value
 for(let hop=0;hop<4;hop++){
  const u=allowedUrl(target,hosts);let resolved=false
  for(const type of ['A','AAAA'] as const){let addresses:string[]=[];try{addresses=await Deno.resolveDns(u.hostname,type)}catch{}for(const ip of addresses){resolved=true;if(/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|192\.0\.(0|2)\.|198\.(18|19)\.|198\.51\.100\.|203\.0\.113\.|2(2[4-9]|[3-5]\d)\.|::|fc|fd|fe[89ab]|ff|2001:db8)/i.test(ip))throw new ApiError(422,'private_address_denied')}}
  if(!resolved)throw new ApiError(422,'source_dns_unavailable')
  const response=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(18000),headers:{'User-Agent':'TechSwipe/0.2 (private RSS reader)','Accept':'application/rss+xml,application/atom+xml,text/html,application/json,image/*'}})
  if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw new ApiError(422,'source_unavailable');target=new URL(location,u).toString();allowedUrl(target,hosts);continue}
  if(!response.ok)throw new ApiError(422,'source_unavailable');return response
 }
 throw new ApiError(422,'source_redirect_limit')
}
export async function safeFetch(value:string,hosts:string[],max=1500000){const response=await safeResponse(value,hosts);const body=await limitedBody(new Request('http://internal',{method:'POST',body:response.body,duplex:'half'} as RequestInit),max);return {body,contentType:response.headers.get('content-type')||'',url:value}}
export function plainText(html:string){return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(Number(d))).replace(/\s+/g,' ').trim()}
