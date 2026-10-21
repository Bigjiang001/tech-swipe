import { db,handler,clientAuth,sha,jsonBody,ApiError,checked } from '../_shared/http.ts'
import { batchSchema } from '../_shared/schema.ts'
Deno.serve(handler('POST',async(req,raw)=>{
 const client=await clientAuth(req,raw,'ingest');const parsed=batchSchema.safeParse(jsonBody(raw));if(!parsed.success){checked(await db.from('submission_logs').insert({client_id:client.id,status:'rejected',error_code:'validation_failed'}));throw new ApiError(422,'validation_failed:'+parsed.error.issues.map(i=>i.path.join('.')).join(','))}
 const body=parsed.data;const {data,error}=await db.rpc('accept_submission',{p_client:client.id,p_key:`${client.id}:${body.idempotency_key}`,p_hash:await sha(JSON.stringify(body)),p_payload:body});if(error)throw new ApiError(error.message.includes('idempotency_conflict')?409:500,error.message.includes('idempotency_conflict')?'idempotency_conflict':'database_error');return {accepted:true,...data}
}))
