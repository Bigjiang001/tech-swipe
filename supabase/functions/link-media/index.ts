import { z } from 'npm:zod@3.25.76'
import { handler,db,ownerAuth,clientAuth,checked,ApiError,jsonBody } from '../_shared/http.ts'
const schema=z.object({link_id:z.string().uuid(),mime:z.enum(['image/jpeg','image/png','image/webp']),base64:z.string().min(1).max(5600000),attribution:z.string().min(1).max(500),is_ai_generated:z.boolean().default(false)}).strict()
Deno.serve(handler('POST',async(req,raw)=>{
 const agent=(req.headers.get('authorization')||'').startsWith('Bearer tsw.');let client:any=null;let owner:string
 if(agent){client=await clientAuth(req,raw,'links');owner=checked(await db.from('profiles').select('id').single()).data!.id}else owner=(await ownerAuth(req)).id
 const parsed=schema.safeParse(jsonBody(raw));if(!parsed.success)throw new ApiError(422,'validation_failed');const b=parsed.data
 const link=checked(await db.from('link_items').select('id,client_id').eq('id',b.link_id).eq('owner_id',owner).single()).data!;if(client&&link.client_id!==client.id)throw new ApiError(403,'own_submission_required')
 let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(b.base64),c=>c.charCodeAt(0))}catch{throw new ApiError(422,'invalid_base64')}
 if(bytes.length>4*1024*1024||bytes.length<12)throw new ApiError(413,'image_size_limit')
 const valid=b.mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:b.mime==='image/png'?[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v):String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';if(!valid)throw new ApiError(422,'image_signature_mismatch')
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer))).map(v=>v.toString(16).padStart(2,'0')).join('')
 const previous=checked(await db.from('link_attachments').select('id').eq('link_id',b.link_id).eq('content_hash',hash)).data;if(previous?.length)return {ok:true,id:previous[0].id,duplicate:true,status:'license_pending_owner_review'}
 const count=await db.from('link_attachments').select('id',{head:true,count:'exact'}).eq('link_id',b.link_id);if(count.error)throw new ApiError(500,'database_error');if((count.count||0)>=5)throw new ApiError(422,'attachment_limit')
 const path=`${owner}/links/${b.link_id}/${hash}.${b.mime.split('/')[1]}`;checked(await db.storage.from('private-media').upload(path,bytes,{contentType:b.mime,upsert:true}));const attachment=checked(await db.from('link_attachments').upsert({link_id:b.link_id,owner_id:owner,storage_path:path,content_hash:hash,attribution:b.attribution,is_ai_generated:b.is_ai_generated},{onConflict:'link_id,content_hash'}).select('id').single()).data!
 return {ok:true,id:attachment.id,duplicate:false,status:'license_pending_owner_review',message:'已存入私人附件，尚未核实许可或发布'}
},6000000))
