import { db,handler,ownerAuth,checked,ApiError,jsonBody,sha } from '../_shared/http.ts'
import { z } from 'npm:zod@3.25.76'
const schema=z.discriminatedUnion('action',[z.object({action:z.literal('status')}).strict(),z.object({action:z.literal('generate')}).strict(),z.object({action:z.literal('url'),id:z.string().uuid()}).strict()])
Deno.serve(handler('POST',async(req,raw)=>{
 const owner=await ownerAuth(req);const body=schema.safeParse(jsonBody(raw));if(!body.success)throw new ApiError(422,'validation_failed')
 const configured=Boolean(Deno.env.get('TTS_BASE_URL')&&Deno.env.get('TTS_API_KEY')&&Deno.env.get('TTS_MODEL'))
 if(body.data.action==='status')return {configured,briefs:checked(await db.from('audio_briefs').select('id,local_date,state,created_at,error_code').eq('owner_id',owner.id).order('created_at',{ascending:false}).limit(7)).data}
 if(body.data.action==='url'){const row=checked(await db.from('audio_briefs').select('storage_path,state').eq('id',body.data.id).eq('owner_id',owner.id).single()).data!;if(row.state!=='ready'||!row.storage_path)throw new ApiError(409,'audio_not_ready');return checked(await db.storage.from('private-media').createSignedUrl(row.storage_path,300)).data}
 if(!configured)throw new ApiError(503,'tts_not_configured')
 const settings=checked(await db.from('settings').select('value').eq('key','publishing').single()).data!.value
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:settings.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 const posts=(checked(await db.from('posts').select('id,title,short_summary,published_at,verification_status,origin').eq('status','published').order('published_at',{ascending:false}).limit(100)).data||[]).filter(p=>p.origin==='agent'&&p.verification_status==='verified'&&new Intl.DateTimeFormat('en-CA',{timeZone:settings.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(p.published_at))===date).slice(0,20)
 if(!posts.length)throw new ApiError(409,'no_verified_today')
 const text='科技刷，今日精选。以下为合成语音播报，请以文章原始出处为准。'+posts.map((p,i)=>`第${i+1}条。${p.title}。${p.short_summary}`).join('。')
 if(text.length>6000)throw new ApiError(422,'audio_text_too_long')
 const voice=Deno.env.get('TTS_VOICE')||'alloy',model=Deno.env.get('TTS_MODEL')!,hash=await sha(model+'\n'+voice+'\n'+text)
 const reservation=await db.rpc('reserve_audio_brief',{p_date:date,p_hash:hash,p_ids:posts.map(p=>p.id)});if(reservation.error)throw new ApiError(429,'audio_generation_limit');const job=reservation.data
 if(!job.claimed)return {id:job.id,state:job.state,cached:job.state==='ready'}
 try{
  const base=new URL(Deno.env.get('TTS_BASE_URL')!);if(base.protocol!=='https:'||base.username||base.password)throw new ApiError(503,'invalid_tts_configuration')
  const response=await fetch(base.toString().replace(/\/$/,'')+'/audio/speech',{method:'POST',redirect:'error',signal:AbortSignal.timeout(45000),headers:{Authorization:`Bearer ${Deno.env.get('TTS_API_KEY')}`,'Content-Type':'application/json'},body:JSON.stringify({model,voice,input:text,response_format:'mp3'})})
  if(!response.ok)throw new ApiError(502,'tts_provider_failed')
  const mime=response.headers.get('content-type')||'';if(!mime.includes('audio/')&&!mime.includes('octet-stream'))throw new ApiError(502,'invalid_audio_response')
  const reader=response.body?.getReader();if(!reader)throw new ApiError(502,'invalid_audio_response');const chunks:Uint8Array[]=[];let length=0;while(true){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>20*1024*1024){await reader.cancel();throw new ApiError(413,'audio_too_large')}chunks.push(r.value)}const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}
  const path=`${owner.id}/audio/${job.id}.mp3`;checked(await db.storage.from('private-media').upload(path,bytes,{contentType:'audio/mpeg',upsert:true}));checked(await db.from('audio_briefs').update({state:'ready',storage_path:path,lease_until:null}).eq('id',job.id));return {id:job.id,state:'ready',cached:false}
 }catch(e){const code=e instanceof ApiError?e.code:'audio_generation_failed';checked(await db.from('audio_briefs').update({state:'failed',error_code:code,lease_until:null}).eq('id',job.id));throw e}
}))
