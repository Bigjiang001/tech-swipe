<script setup lang="ts">
import { ref,onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../lib/supabase'
import { useApp } from '../stores/app'
import Icon from '../components/Icon.vue'
const route=useRoute(),app=useApp(),info=ref<{name:string;redirect_uri:string}|null>(null),error=ref(''),busy=ref(false)
const payload=Object.fromEntries(['client_id','redirect_uri','code_challenge','state'].map(k=>[k,String(route.query[k]||'')]))
async function request(path:string){if(!supabase||app.demo)throw new Error('请使用私人所有者账号登录后授权');const r=await supabase.functions.invoke('gpt-auth/'+path,{body:payload});if(r.error||r.data?.error)throw new Error('授权请求无效或已经过期，请从 ChatGPT 重新连接。');return r.data}
onMounted(async()=>{try{info.value=await request('info')}catch(e){error.value=app.errorMessage(e)}})
async function approve(){busy.value=true;try{const r=await request('approve');const target=new URL(r.redirect_url);if(target.origin!=='https://chatgpt.com'||!target.pathname.startsWith('/connector/oauth/'))throw new Error('授权回调地址不匹配');window.location.assign(target.toString())}catch(e){error.value=app.errorMessage(e);busy.value=false}}
</script>
<template><div class="page connect-page"><div class="page-heading"><div><div class="eyebrow">CONNECT WITH YOUR CONSENT</div><h1>连接你的研究助手<span class="orange">。</span></h1><p>只有你可以批准这次连接。</p></div><Icon name="ShieldCheck" :size="34"/></div><section class="form-card"><template v-if="info"><h2>{{info.name}}</h2><p>此连接将获得「提交链接与新闻草稿」权限：</p><ul><li>向收件箱提交原文网址、理由和标签。</li><li>提交中文新闻草稿与有权使用的图片。</li><li>查询该连接自己提交的资料和任务状态。</li></ul><p>不能读取你的私人笔记、现有新闻或图片；不能发布、删除新闻或修改设置。图片仍待你确认授权，新闻仍需独立核验或人工审核。</p><small class="muted">返回地址：{{info.redirect_uri}}</small><div class="inbox-actions"><button class="btn primary" :disabled="busy" @click="approve">{{busy?'正在连接…':'同意并返回 ChatGPT'}}<Icon name="ArrowUpRight" :size="16"/></button><RouterLink to="/inbox" class="btn outline">暂不连接</RouterLink></div><p class="form-hint">可以随时在管理后台「GPT 接口」撤销连接。你不需要复制或粘贴任何密钥。</p></template><p v-else>{{error?'无法继续授权':'正在核对连接请求…'}}</p><p v-if="error" class="form-error">{{error}}</p></section></div></template>
