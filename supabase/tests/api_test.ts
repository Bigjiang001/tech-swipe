// API handler tests: actual WebCrypto HMAC + schema; PostgREST is a controlled fake.
// Database grants, RLS, and transactional idempotency are tested separately on PGlite.
Deno.env.set('SUPABASE_URL','https://database.example.test')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','test-service-key')
Deno.env.set('SUPABASE_ANON_KEY','test-public-key')
const id='44444444-4444-4444-8444-444444444444',secret='a'.repeat(64)
const {sha}=await import('../functions/_shared/http.ts')
const hash=await sha(secret)
const nonces=new Set<string>(),jobs=new Map<string,{hash:string;id:string}>()
let active=true,scopes=['ingest','status']
globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{const req=new Request(input,init);const u=new URL(req.url);const body=req.method==='POST'?await req.json():null;let data:unknown=null
 if(u.pathname==='/rest/v1/api_clients'){data={id,name:'test-agent',token_hash:hash,active,scopes,expires_at:'2099-01-01T00:00:00Z'}}
 else if(u.pathname.endsWith('/reserve_request')){if(nonces.has(body.p_nonce))return Response.json({message:'duplicate',code:'23505'},{status:409});nonces.add(body.p_nonce)}
 else if(u.pathname.endsWith('/accept_submission')){const old=jobs.get(body.p_key);if(old&&old.hash!==body.p_hash)return Response.json({message:'idempotency_conflict',code:'P0001'},{status:400});const job=old||{hash:body.p_hash,id:crypto.randomUUID()};jobs.set(body.p_key,job);data={job_id:job.id,status:'pending',duplicate:!!old}}
 else if(u.pathname==='/rest/v1/submission_logs'){data=null}
 else throw new Error('Unexpected fake DB path: '+u.pathname)
 return Response.json(data)
}) as typeof fetch
let handle:((r:Request)=>Promise<Response>)|null=null
const realServe=Deno.serve
Deno.serve=((fn:unknown)=>{handle=fn as typeof handle;return {} as Deno.HttpServer}) as typeof Deno.serve
await import('../functions/news-ingest/index.ts')
Deno.serve=realServe
async function signed(payload:unknown,options:{key?:string;nonce?:string;timestamp?:string}={}){const raw=JSON.stringify(payload),ts=options.timestamp||String(Math.floor(Date.now()/1000)),nonce=options.nonce||crypto.randomUUID(),keySecret=options.key||secret;const target='/functions/v1/news-ingest';const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(keySecret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(['POST',target,ts,nonce,await sha(raw)].join('\n'))))).map(v=>v.toString(16).padStart(2,'0')).join('');return new Request('https://app.example.test'+target,{method:'POST',headers:{Authorization:`Bearer tsw.${id}.${keySecret}`,'Content-Type':'application/json','X-TS-Timestamp':ts,'X-TS-Nonce':nonce,'X-TS-Signature':sig},body:raw})}
function expect(value:unknown,expected:unknown){if(JSON.stringify(value)!==JSON.stringify(expected))throw new Error(`Expected ${JSON.stringify(expected)} got ${JSON.stringify(value)}`)}
const post={external_id:'test-event-1',idempotency_key:'test-event-1',title:'这是一条严格标记的模拟投稿用于接口测试',category:'AI',short_summary:'这是一条严格标记的模拟投稿，不代表真实新闻。'.repeat(3),medium_summary:'这是测试中的中等长度摘要，用于验证结构长度和字段约束，不代表真实新闻。'.repeat(6),full_content:'这是模拟接口测试的详细内容，没有对应的真实新闻，不应被直接发布。'.repeat(15),key_points:['这是测试字段，不是新闻事实','调用方的核验状态不会直接决定发布','无来源或未核验的内容应停留在草稿'],source_name:'Test',source_url:'https://example.org/test',source_published_at:new Date(Date.now()-3600000).toISOString(),event_time:null,tags:['测试'],image_url:null,image_attribution:'',is_ai_generated_image:false,verification_status:'verified',generated_at:new Date().toISOString(),submitted_by:'test',evidence_urls:[]}
Deno.test('valid simulated GPT batch is accepted into durable pending queue',async()=>{const r=await handle!(await signed({idempotency_key:'test-batch-1',posts:[post]}));expect(r.status,202);expect((await r.json()).status,'pending')})
Deno.test('wrong credential is rejected',async()=>{const r=await handle!(await signed({},{key:'b'.repeat(64)}));expect(r.status,401);expect((await r.json()).error,'invalid_credentials')})
Deno.test('revoked client is rejected',async()=>{active=false;const r=await handle!(await signed({}));active=true;expect(r.status,401)})
Deno.test('missing scope is rejected',async()=>{scopes=['status'];const r=await handle!(await signed({}));scopes=['ingest','status'];expect(r.status,403)})
Deno.test('same signed nonce cannot replay',async()=>{const nonce=crypto.randomUUID();const body={idempotency_key:'test-replay',posts:[post]};expect((await handle!(await signed(body,{nonce}))).status,202);const r=await handle!(await signed(body,{nonce}));expect(r.status,409);expect((await r.json()).error,'replay_rejected')})
Deno.test('same batch key returns existing job with fresh nonce',async()=>{const body={idempotency_key:'test-duplicate',posts:[post]};const one=await(await handle!(await signed(body))).json();const two=await(await handle!(await signed(body))).json();expect(one.job_id,two.job_id);expect(two.duplicate,true)})
Deno.test('changed payload under same batch key conflicts',async()=>{const body={idempotency_key:'test-conflict',posts:[post]};await handle!(await signed(body));const r=await handle!(await signed({...body,posts:[{...post,title:'这是另一个模拟标题用于冲突测试'}]}));expect(r.status,409)})
Deno.test('unknown published flag / unsafe URL fail strict schema',async()=>{for(const altered of [{...post,published:true},{...post,source_url:'javascript:alert(1)'}]){const r=await handle!(await signed({idempotency_key:'test-invalid',posts:[altered]}));expect(r.status,422)}})
Deno.test('old signature is rejected before accepting a submission',async()=>{expect((await handle!(await signed({},{timestamp:'1234567890'}))).status,401)})
Deno.test('anonymous request is rejected',async()=>{expect((await handle!(new Request('https://app.example.test/functions/v1/news-ingest',{method:'POST',body:'{}'}))).status,401)})
