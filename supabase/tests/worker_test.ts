// Exercise real worker handler and verification policy through controlled HTTP boundaries.
Deno.env.set('SUPABASE_URL','https://database.example.test')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','test-service-key')
Deno.env.set('SUPABASE_ANON_KEY','test-public-key')
for(const key of ['VERIFY_API_KEY','VERIFY_MODEL','VERIFY_BASE_URL'])Deno.env.delete(key)
const {sha}=await import('../functions/_shared/http.ts')
const client='44444444-4444-4444-8444-444444444444',secret='a'.repeat(64),hash=await sha(secret),owner='11111111-1111-4111-8111-111111111111'
const now=new Date().toISOString()
const item={external_id:'bad-item',idempotency_key:'external-item',content_kind:'news',title:'这是一条测试工作队列的中文标题',category:'AI',short_summary:'这是一条模拟的中文新闻摘要，不代表真实报道，专门用于测试后台任务对数据的安全处理。'.repeat(2),medium_summary:'中等长度的测试内容，不代表真实新闻，不应被自动发布。'.repeat(10),full_content:'用于验证事实核验策略的模拟内容，这里没有真实新闻事件，不应把提交方的核验标识当成可信结论。'.repeat(10),key_points:['不信任调用方声明的核验状态','坏来源不能阻塞整批后续新闻','没有核验服务时只能保存草稿'],source_name:'Test',source_url:'https://unapproved.test/event',source_published_at:now,event_time:null,tags:['测试'],image_url:null,image_attribution:'',is_ai_generated_image:false,verification_status:'verified',generated_at:now,submitted_by:'test',evidence_urls:[]}
const job:Record<string,any>={id:'55555555-5555-4555-8555-555555555555',client_id:client,lease_token:'66666666-6666-4666-8666-666666666666',kind:'ingest',status:'pending',attempts:0,payload:{idempotency_key:'worker-batch',posts:[item,{...item,external_id:'good-item',source_url:'https://approved.test/event'}]},result:null}
let savedPost:Record<string,any>|null=null,uploads=0,failedRuns=0
// DNS is checked separately by the networking helper. Use a fixed public test IP.
const dns=Deno.resolveDns
Deno.resolveDns=(async()=>['93.184.216.34']) as unknown as typeof Deno.resolveDns
globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{const req=new Request(input,init),u=new URL(req.url);const body=req.method==='POST'||req.method==='PATCH'?await req.text():'';const value=body&&!u.pathname.startsWith('/storage/')?JSON.parse(body):null;let data:unknown=null
 if(u.hostname==='approved.test')return new Response('<html>'+('Independent source fixture with a lawful explanatory summary. '.repeat(20))+'</html>')
 if(u.pathname==='/rest/v1/api_clients')data={id:client,name:'runner',token_hash:hash,active:true,scopes:['worker'],expires_at:'2099-01-01T00:00:00Z'}
 else if(u.pathname.endsWith('/reserve_request'))data=null
 else if(u.pathname.endsWith('/claim_job')){if(job.status==='pending'){job.status='running';job.attempts++;data=[{...job}]}else data=[]}
 else if(u.pathname==='/rest/v1/news_sources')data=[{id:'source',name:'Approved source',url:'https://approved.test/feed',enabled:true,official:true,source_type:'rss',content_hosts:[],image_policy:'illustration'}]
 else if(u.pathname==='/rest/v1/profiles')data={id:owner}
 else if(u.pathname.startsWith('/storage/v1/object/')){uploads++;data={Key:'private-media/test.svg'}}
 else if(u.pathname==='/rest/v1/posts'&&req.method==='GET')data=u.searchParams.has('external_id')?{id:savedPost!.id}:[]
 else if(u.pathname==='/rest/v1/posts'&&req.method==='POST'){savedPost=value;data=null}
 else if(u.pathname==='/rest/v1/agent_jobs'&&req.method==='PATCH'){Object.assign(job,value);data=null}
 else if(u.pathname==='/rest/v1/agent_runs'){failedRuns++;data=null}
 else if(['/rest/v1/submission_logs','/rest/v1/media_assets','/rest/v1/post_sources'].includes(u.pathname))data=null
 else throw new Error('Unexpected fixture path: '+u.pathname)
 return Response.json(data)
}) as typeof fetch
let handle:((r:Request)=>Promise<Response>)|null=null
const serve=Deno.serve
Deno.serve=((fn:unknown)=>{handle=fn as typeof handle;return {} as Deno.HttpServer}) as typeof Deno.serve
await import('../functions/news-worker/index.ts');Deno.serve=serve
async function run(){const raw='{"action":"drain"}',path='/functions/v1/news-worker',ts=String(Math.floor(Date.now()/1000)),nonce=crypto.randomUUID();const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(['POST',path,ts,nonce,await sha(raw)].join('\n'))))).map(v=>v.toString(16).padStart(2,'0')).join('');return await(await handle!(new Request('https://app.test'+path,{method:'POST',headers:{Authorization:`Bearer tsw.${client}.${secret}`,'X-TS-Timestamp':ts,'X-TS-Nonce':nonce,'X-TS-Signature':sig},body:raw}))).json()}
function assert(v:unknown,message:string){if(!v)throw new Error(message)}
Deno.test('bad source is rejected durably while remaining item stays processable',async()=>{const r=await run();assert(r.rejected===true,'bad source should reject');assert(job.status==='pending','job must continue for remaining item');assert(job.result.processed.includes('bad-item'),'rejection progress must persist');assert(failedRuns===1,'failure run must be recorded')})
Deno.test('caller verified flag never bypasses independent verification; good item becomes draft',async()=>{const r=await run();assert(r.status==='failed','partially rejected job is surfaced');assert(savedPost!==null,'good remaining item should be stored');assert(savedPost!.verification_status==='pending','must not trust submitted verified flag');assert(savedPost!.status==='draft','no verifier => no automatic queue');assert(uploads===1,'original private illustration should be stored');assert(job.result.processed.length===2,'both items finished without duplicate inserts');Deno.resolveDns=dns})
