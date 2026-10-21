import { db,handler,clientAuth,checked,jsonBody,ApiError } from '../_shared/http.ts'
Deno.serve(handler('POST',async(req,raw)=>{await clientAuth(req,raw,'publish');const body=jsonBody(raw);if(Object.keys(body).length)throw new ApiError(422,'empty_object_required');return checked(await db.rpc('publish_daily',{p_manual:false})).data}))
