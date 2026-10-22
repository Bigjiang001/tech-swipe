<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useApp } from '../stores/app'
const props=defineProps<{linkId:string}>(),app=useApp(),opened=ref(false),busy=ref(false),error=ref(''),rows=ref<{id:string;url:string;attribution:string;is_ai_generated:boolean}[]>([])
async function load(){opened.value=!opened.value;if(!opened.value||app.demo||!supabase)return;busy.value=true;error.value='';try{const r=await supabase.from('link_attachments').select('id,storage_path,attribution,is_ai_generated').eq('link_id',props.linkId);if(r.error)throw r.error;rows.value=await Promise.all((r.data||[]).map(async m=>{const signed=await supabase!.storage.from('private-media').createSignedUrl(m.storage_path,300);if(signed.error)throw signed.error;return {...m,url:signed.data.signedUrl}}))}catch{error.value='附件暂时无法加载，请关闭后重新打开。'}finally{busy.value=false}}
</script>
<template><div><button class="source-link" @click="load">{{opened?'收起附件':'查看投稿附件'}}</button><div v-if="opened" class="article-gallery"><small v-if="busy">正在获取私人附件…</small><p v-else-if="!rows.length" class="muted">此资料暂无图片附件。</p><figure v-for="m in rows" :key="m.id"><img :src="m.url" :alt="m.attribution" loading="lazy"/><figcaption>{{m.attribution}}{{m.is_ai_generated?' · AI 示意图':''}} · 投稿者声明，许可尚待你确认</figcaption></figure><p v-if="error" class="form-error">{{error}}</p></div></div></template>
