Deno.env.set('SUPABASE_URL','https://database.example.test')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','test-service-key')
const {sha}=await import('../functions/_shared/http.ts')
const id='44444444-4444-4444-8444-444444444444',owner='11111111-1111-4111-8111-111111111111',link='33333333-3333-4333-8333-333333333333',secret='a'.repeat(64),hash=await sha(secret)
let scope='links'
const row:any={id:link,owner_id:owner,canonical_url:'https://approved.example/article',title:'Original title',excerpt:'Original legal excerpt',stage:'extracted',origin:'collector',client_id:null,reason:'',tags:[],post_id:null,source_published_at:new Date().toISOString()}
const dns=Deno.resolveDns;Deno.resolveDns=(async()=>['93.184.216.34']) as any
const originalFetch=globalThis.fetch
globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{const req=new Request(input,init),u=new URL(req.url);let data:any=null;const body=['POST','PATCH'].includes(req.method)?JSON.parse(await req.text()):null
 if(u.hostname==='approved.example'){if(u.pathname==='/article')return new Response('Forbidden',{status:403});return new Response(`<rss><channel><item><title>Official feed title</title><link>https://approved.example/article</link><pubDate>${new Date().toUTCString()}</pubDate><description>Legal source summary</description></item></channel></rss>`,{headers:{'content-type':'application/rss+xml'}})}
 if(u.pathname==='/rest/v1/api_clients')data={id,token_hash:hash,active:true,expires_at:'2099-01-01T00:00:00Z',scopes:[scope]}
 else if(u.pathname==='/rest/v1/profiles')data={id:owner}
 else if(u.pathname.endsWith('/reserve_request'))data=null
 else if(u.pathname.endsWith('/claim_link_item')){row.stage='processing';data=[{...row}]}
 else if(u.pathname==='/rest/v1/news_sources')data=[{id:'source',enabled:true,name:'Official RSS',url:'https://approved.example/feed',source_type:'rss',content_hosts:[]}]
 else if(u.pathname==='/rest/v1/link_items'&&req.method==='POST')data=[]
 else if(u.pathname==='/rest/v1/link_items'&&req.method==='GET')data={...row}
 else if(u.pathname==='/rest/v1/link_items'&&req.method==='PATCH'){Object.assign(row,body);data=null}
 else throw new Error('Unexpected fixture path '+u.pathname)
 return Response.json(data)
}) as typeof fetch
let handle:((req:Request)=>Promise<Response>)|null=null
const serve=Deno.serve;Deno.serve=((fn:any)=>{handle=fn;return {} as Deno.HttpServer}) as typeof Deno.serve
await import('../functions/link-api/index.ts');Deno.serve=serve
async function call(body:unknown){const raw=JSON.stringify(body),path='/functions/v1/link-api',ts=String(Math.floor(Date.now()/1000)),nonce=crypto.randomUUID();const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(['POST',path,ts,nonce,await sha(raw)].join('\n'))))).map(v=>v.toString(16).padStart(2,'0')).join('');return handle!(new Request('https://app.example'+path,{method:'POST',headers:{Authorization:`Bearer tsw.${id}.${secret}`,'X-TS-Timestamp':ts,'X-TS-Nonce':nonce,'X-TS-Signature':signature},body:raw}))}
function assert(v:unknown){if(!v)throw new Error('Link API scenario failed')}
Deno.test('saving a collected URL promotes it into own inbox without losing source material',async()=>{const response=await call({action:'submit',items:[{url:row.canonical_url,title:'我的中文资料标题',reason:'值得追踪的具体原因',tags:['AI'],category:'AI'}]});const result=await response.json();assert(response.status===200);assert(result.items[0].duplicate===true);assert(row.origin==='agent'&&row.client_id===id);assert(row.reason==='值得追踪的具体原因');assert(row.excerpt==='Original legal excerpt')})
Deno.test('blocked webpage falls back to the approved original RSS without fabricating a date',async()=>{scope='collect';row.stage='saved';const response=await call({action:'process-link'});const result=await response.json();assert(response.status===200&&result.ok);assert(row.stage==='extracted');assert(row.title==='我的中文资料标题');assert(row.excerpt==='Legal source summary');assert(row.metadata.extraction==='rss_fallback');assert(Boolean(row.source_published_at));Deno.resolveDns=dns;globalThis.fetch=originalFetch})
