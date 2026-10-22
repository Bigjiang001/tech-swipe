import { z } from 'npm:zod@3.25.76'
import { db,checked,ownerAuth,headers,limitedBody,ApiError,sha } from '../_shared/http.ts'
import { apiBase,authBase,resource,callbackAllowed,randomSecret,pkce,originAllowed } from '../_shared/oauth.ts'
Deno.serve(async(req:Request)=>{
 const h=headers(req);try{
 originAllowed(req);if(req.method==='OPTIONS')return new Response(null,{status:204,headers:h})
 const u=new URL(req.url),path=u.pathname.replace(/^\/functions\/v1/,'').replace(/^\/gpt-auth/,'')||'/'
 const json=(body:unknown,status=200)=>Response.json(body,{status,headers:h})
 if(req.method==='GET'&&(path==='/.well-known/oauth-authorization-server'||path==='/.well-known/openid-configuration'||path==='/'))return json({...(path==='/.well-known/openid-configuration'?{jwks_uri:Deno.env.get('SUPABASE_URL')+'/auth/v1/.well-known/jwks.json',subject_types_supported:[],id_token_signing_alg_values_supported:[]}:{}),issuer:authBase(),authorization_endpoint:authBase()+'/authorize',token_endpoint:authBase()+'/token',registration_endpoint:authBase()+'/register',response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none'],scopes_supported:['techswipe.submit']})
 if(req.method==='POST'&&path==='/register'){
  const parsed=z.object({client_name:z.string().min(1).max(80).default('ChatGPT'),redirect_uris:z.array(z.string().max(2000).refine(callbackAllowed)).min(1).max(3),token_endpoint_auth_method:z.literal('none').optional(),grant_types:z.array(z.enum(['authorization_code','refresh_token'])).optional(),response_types:z.array(z.literal('code')).optional()}).passthrough().safeParse(JSON.parse(await limitedBody(req,12000)));if(!parsed.success)throw new ApiError(400,'invalid_client_metadata')
  const result=await db.rpc('oauth_register',{p_name:parsed.data.client_name,p_redirects:parsed.data.redirect_uris});if(result.error)throw new ApiError(429,'registration_limit')
  return json({client_id:result.data,client_name:parsed.data.client_name,redirect_uris:parsed.data.redirect_uris,token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code']},201)
 }
 if(req.method==='GET'&&path==='/authorize'){
  const client=u.searchParams.get('client_id')||'',redirect=u.searchParams.get('redirect_uri')||'',challenge=u.searchParams.get('code_challenge')||'',state=u.searchParams.get('state')||''
  if(u.searchParams.get('response_type')!=='code'||u.searchParams.get('code_challenge_method')!=='S256'||!/^[A-Za-z0-9_-]{43}$/.test(challenge)||state.length>2000||!callbackAllowed(redirect)||(u.searchParams.get('scope')||'techswipe.submit')!=='techswipe.submit'||(u.searchParams.has('resource')&&u.searchParams.get('resource')!==resource()))throw new ApiError(400,'invalid_authorization_request')
  const info=checked(await db.rpc('oauth_client_info',{p_id:client})).data;if(!info?.redirect_uris.includes(redirect))throw new ApiError(400,'invalid_client')
  const frontend=(Deno.env.get('ALLOWED_ORIGINS')||'').split(',').find(x=>x.endsWith('.github.io'));if(!frontend)throw new ApiError(503,'consent_page_not_configured')
  const page=new URL('/tech-swipe/',frontend);page.hash='/connect?'+new URLSearchParams({client_id:client,redirect_uri:redirect,code_challenge:challenge,state}).toString();return new Response(null,{status:302,headers:{...h,Location:page.toString()}})
 }
 if(req.method==='POST'&&(path==='/info'||path==='/approve')){
  const actor=await ownerAuth(req);const body=JSON.parse(await limitedBody(req,12000));const parsed=z.object({client_id:z.string().uuid(),redirect_uri:z.string().max(2000).refine(callbackAllowed),code_challenge:z.string().regex(/^[A-Za-z0-9_-]{43}$/),state:z.string().max(2000)}).strict().safeParse(body);if(!parsed.success)throw new ApiError(400,'invalid_authorization_request');const b=parsed.data
  const info=checked(await db.rpc('oauth_client_info',{p_id:b.client_id})).data;if(!info?.redirect_uris.includes(b.redirect_uri))throw new ApiError(400,'invalid_client')
  if(path==='/info')return json({name:info.name,redirect_uri:b.redirect_uri,scope:'techswipe.submit'})
  const code=randomSecret();const allowed=checked(await db.rpc('oauth_authorize',{p_client:b.client_id,p_redirect:b.redirect_uri,p_challenge:b.code_challenge,p_code_hash:await sha(code)})).data;if(!allowed)throw new ApiError(400,'invalid_client');checked(await db.from('admin_audit_logs').insert({actor_id:actor.id,action:'oauth-authorize',target_id:b.client_id}));const redirect=new URL(b.redirect_uri);redirect.searchParams.set('code',code);redirect.searchParams.set('state',b.state);redirect.searchParams.set('iss',authBase());return json({redirect_url:redirect.toString()})
 }
 if(req.method==='POST'&&path==='/token'){
  const b=new URLSearchParams(await limitedBody(req,12000));if(!z.string().uuid().safeParse(b.get('client_id')).success)throw new ApiError(400,'invalid_client');if(b.has('resource')&&b.get('resource')!==resource())throw new ApiError(400,'invalid_target')
  const secret=randomSecret(),refresh=randomSecret();let result:any
  if(b.get('grant_type')==='authorization_code'){const code=b.get('code')||'';if(!/^[a-f0-9]{64}$/.test(code))throw new ApiError(400,'invalid_grant');result=await db.rpc('oauth_exchange',{p_client:b.get('client_id'),p_redirect:b.get('redirect_uri')||'',p_challenge:await pkce(b.get('code_verifier')||''),p_code_hash:await sha(code),p_access_hash:await sha(secret),p_refresh_hash:await sha(refresh)})}
  else if(b.get('grant_type')==='refresh_token')result=await db.rpc('oauth_refresh',{p_client:b.get('client_id'),p_refresh_hash:await sha(b.get('refresh_token')||''),p_access_hash:await sha(secret),p_next_refresh_hash:await sha(refresh)})
  else throw new ApiError(400,'unsupported_grant_type')
  if(result.error||!result.data)throw new ApiError(400,'invalid_grant')
  return json({access_token:`tsw.${result.data.access_id}.${secret}`,token_type:'Bearer',expires_in:3600,refresh_token:refresh,scope:'techswipe.submit'})
 }
 throw new ApiError(404,'not_found')
 }catch(e){const err=e instanceof ApiError?e:new ApiError(400,'invalid_request');return Response.json({error:err.code},{status:err.status,headers:h})}
})
