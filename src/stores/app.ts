import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { supabase, configured, demoAllowed } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Post, Note, Follow, Settings, AgentJob, NewsSource } from '../lib/types'

const DEMO_KEY='techswipe-demo-v1'
export const useApp = defineStore('app', () => {
 const user=ref<User|null>(null), owner=ref(false), demo=ref(false), ready=ref(false), loading=ref(false)
 const posts=ref<Post[]>([]), likes=ref<string[]>([]), bookmarks=ref<string[]>([]), notes=ref<Note[]>([]), follows=ref<Follow[]>([]), read=ref<string[]>([])
 const jobs=ref<AgentJob[]>([]), sources=ref<NewsSource[]>([]), logs=ref<Record<string,unknown>[]>([]), toast=ref('')
 const settings=ref<Settings>({timezone:'Asia/Tokyo',daily_target:20,auto_publish:false,agent_enabled:false})
 const authenticated=computed(()=>demo.value || (user.value!==null && owner.value))
 const published=computed(()=>posts.value.filter(p=>p.status==='published').sort((a,b)=>Number(b.pinned)-Number(a.pinned)||(b.published_at||'').localeCompare(a.published_at||'')))
 let toastTimer:ReturnType<typeof setTimeout>
 function notify(message:string) {toast.value=message; clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.value='',4000)}
 function check<T extends {error:unknown}>(result:T):T {if(result.error) throw result.error; return result}
 function errorMessage(e:unknown) {return e instanceof Error ? e.message : typeof e==='object'&&e&&'message' in e ? String(e.message) : '操作失败，请检查网络后重试'}
 async function safely(action:()=>Promise<void>) {try {await action()} catch(e){notify(errorMessage(e)); throw e}}
 function persist() {if(demo.value) localStorage.setItem(DEMO_KEY,JSON.stringify({posts:posts.value.filter(p=>p.origin==='manual'),likes:likes.value,bookmarks:bookmarks.value,notes:notes.value,follows:follows.value,read:read.value,settings:settings.value}))}
 async function enterDemo() {
  if(!demoAllowed) return
  const {demoPosts}=await import('../data/demo')
  let saved:Record<string,any>={}; try{saved=JSON.parse(localStorage.getItem(DEMO_KEY)||'{}')}catch{localStorage.removeItem(DEMO_KEY)}
  sessionStorage.setItem('techswipe-demo-active','1');demo.value=true; posts.value=[...(saved.posts||[]),...demoPosts]; likes.value=saved.likes||[];bookmarks.value=saved.bookmarks||[];notes.value=saved.notes||[];follows.value=saved.follows||[];read.value=saved.read||[]
  if(saved.settings) settings.value=saved.settings
 }
 async function initialize() {
  if(ready.value) return
  if(demoAllowed&&sessionStorage.getItem('techswipe-demo-active')==='1'){await enterDemo();ready.value=true;return}
  if(supabase) {
   try {const {data,error}=await supabase.auth.getSession(); if(error) throw error; await setUser(data.session?.user||null)}catch(e){notify(errorMessage(e))}
   supabase.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){clearPrivate()} else if(event==='TOKEN_REFRESHED') user.value=session?.user||null})
  }
  ready.value=true
 }
 async function setUser(next:User|null) {
  user.value=next; owner.value=false
  if(next&&supabase){const {data}=check(await supabase.rpc('is_owner'));owner.value=Boolean(data);if(!owner.value){await supabase.auth.signOut();user.value=null;throw new Error('此账号不是所有者，无权访问私人内容')} await load()}
 }
 async function login(email:string,password:string) {if(!supabase)throw new Error('请先配置 Supabase，或进入演示模式');const {data}=check(await supabase.auth.signInWithPassword({email,password}));await setUser(data.user)}
 function clearPrivate(){sessionStorage.removeItem('techswipe-demo-active');user.value=null;owner.value=false;demo.value=false;posts.value=[];likes.value=[];bookmarks.value=[];notes.value=[];follows.value=[];read.value=[];jobs.value=[];sources.value=[];logs.value=[]}
 async function logout(){if(supabase&&user.value)check(await supabase.auth.signOut());clearPrivate()}
 async function load() {
  if(!supabase||!owner.value)return
  loading.value=true
  try {
   const results=await Promise.all([supabase.from('posts').select('*').order('published_at',{ascending:false}),supabase.from('likes').select('post_id'),supabase.from('bookmarks').select('post_id'),supabase.from('comments').select('*').order('created_at'),supabase.from('follows').select('kind,value'),supabase.from('reading_history').select('post_id'),supabase.from('settings').select('value').eq('key','publishing').single()])
   results.forEach(check)
   posts.value=results[0]!.data as unknown as Post[];likes.value=(results[1]!.data||[]).map((r:any)=>r.post_id);bookmarks.value=(results[2]!.data||[]).map((r:any)=>r.post_id);notes.value=results[3]!.data as unknown as Note[];follows.value=results[4]!.data as unknown as Follow[];read.value=(results[5]!.data||[]).map((r:any)=>r.post_id);settings.value=results[6]!.data?.value as Settings
  } finally {loading.value=false}
 }
 async function toggleInteraction(kind:'likes'|'bookmarks',id:string) {
  const list=kind==='likes'?likes:bookmarks;const exists=list.value.includes(id)
  await safely(async()=>{if(!demo.value&&supabase){check(exists?await supabase.from(kind).delete().eq('post_id',id):await supabase.from(kind).insert({post_id:id,user_id:user.value!.id}))}list.value=exists?list.value.filter(x=>x!==id):[...list.value,id];persist()})
 }
 async function addNote(post_id:string,body:string){if(!body.trim()||body.length>5000)return;await safely(async()=>{const note={id:crypto.randomUUID(),post_id,body:body.trim(),created_at:new Date().toISOString()};if(!demo.value&&supabase)check(await supabase.from('comments').insert({...note,user_id:user.value!.id}));notes.value.push(note);persist()})}
 async function deleteNote(id:string){await safely(async()=>{if(!demo.value&&supabase)check(await supabase.from('comments').delete().eq('id',id));notes.value=notes.value.filter(x=>x.id!==id);persist()})}
 async function toggleFollow(kind:Follow['kind'],value:string){await safely(async()=>{const exists=follows.value.some(f=>f.kind===kind&&f.value===value);if(!demo.value&&supabase)check(exists?await supabase.from('follows').delete().eq('kind',kind).eq('value',value):await supabase.from('follows').insert({kind,value,user_id:user.value!.id}));follows.value=exists?follows.value.filter(f=>!(f.kind===kind&&f.value===value)):[...follows.value,{kind,value}];persist()})}
 async function markRead(id:string){if(read.value.includes(id))return;try{if(!demo.value&&supabase)check(await supabase.from('reading_history').upsert({user_id:user.value!.id,post_id:id},{onConflict:'user_id,post_id'}));read.value.push(id);persist()}catch(e){notify(errorMessage(e))}}
 async function imageFor(post:Post){if(demo.value)return post.image_url||'';if(post.image_path&&supabase){const {data}=check(await supabase.storage.from('private-media').createSignedUrl(post.image_path,300));if(!data)throw new Error("无法签发图片链接");return data.signedUrl}const covers:Record<string,string>={'科技':'tech','AI':'ai','财经':'finance','社会':'society','人文':'culture','艺术':'art'};return `${import.meta.env.BASE_URL}covers/${covers[post.category]||'tech'}.svg`}
 async function uploadImage(file:File) {if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw new Error('仅支持 8MB 以内的 JPG、PNG、WebP 图片');if(demo.value){if(file.size>1000000)throw new Error('演示模式图片请小于 1MB');return await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file)})}if(!supabase)throw new Error('未连接');const path=`${user.value!.id}/${crypto.randomUUID()}.${file.type.split('/')[1]}`;check(await supabase.storage.from('private-media').upload(path,file));return path}
 async function savePost(post:Post){await safely(async()=>{if(!demo.value&&supabase){const {image_url,related_sources,...row}=post;const result=check(await supabase.from('posts').upsert({...row,owner_id:user.value!.id}).select('*').single());post=result.data as Post;}const i=posts.value.findIndex(p=>p.id===post.id);if(i>=0)posts.value[i]=post;else posts.value.unshift(post);persist();notify('内容已保存')})}
 async function deletePost(id:string){await safely(async()=>{if(!demo.value&&supabase)check(await supabase.from('posts').delete().eq('id',id));posts.value=posts.value.filter(p=>p.id!==id);persist();notify('新闻已删除')})}
 async function admin(action:string,payload:Record<string,unknown>={}) {
  if(demo.value){notify('此操作需要连接 Supabase；演示模式不会启动真实 Agent');return null}
  if(!supabase)throw new Error('未连接服务端')
  const {data}=check(await supabase.functions.invoke('admin-control',{body:{action,...payload}})); if(data?.error)throw new Error(data.error);return data
 }
 async function loadAdmin(){if(demo.value)return;await safely(async()=>{if(!supabase)return;const results=await Promise.all([supabase.from('agent_jobs').select('*').order('created_at',{ascending:false}).limit(30),supabase.from('news_sources').select('*').order('name'),supabase.from('submission_logs').select('id,created_at,client_id,status,post_count,error_code').order('created_at',{ascending:false}).limit(30)]);results.forEach(check);jobs.value=results[0]!.data as AgentJob[];sources.value=results[1]!.data as NewsSource[];logs.value=results[2]!.data as Record<string,unknown>[]})}
 async function saveSettings(value:Settings){if(!demo.value&&supabase)check(await supabase.from('settings').update({value}).eq('key','publishing'));settings.value=value;persist();notify('设置已保存')}
 return {configured,user,owner,demo,ready,loading,posts,published,likes,bookmarks,notes,follows,read,settings,jobs,sources,logs,toast,authenticated,notify,initialize,enterDemo,login,logout,load,toggleInteraction,addNote,deleteNote,toggleFollow,markRead,imageFor,uploadImage,savePost,deletePost,admin,loadAdmin,saveSettings,errorMessage}
})
