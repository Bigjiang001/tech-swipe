<script setup lang="ts">
import { ref,watch } from 'vue'
import InfoGallery from './InfoGallery.vue'
import type { Post } from '../lib/types'
import { supabase } from '../lib/supabase'
import { useApp } from '../stores/app'
const props=defineProps<{postId:string;post?:Post}>(),app=useApp(),rows=ref<{id:string;url:string;attribution:string}[]>([]),error=ref('')
let generation=0
async function load(){const n=++generation;rows.value=[];error.value='';if(app.demo||!supabase)return;try{const r=await supabase.from('post_media').select('id,storage_path,attribution,is_ai_generated').eq('post_id',props.postId).order('position');if(r.error)throw r.error;const next=await Promise.all((r.data||[]).map(async m=>{const signed=await supabase!.storage.from('private-media').createSignedUrl(m.storage_path,300);if(signed.error)throw signed.error;return {id:m.id,url:signed.data.signedUrl,attribution:m.attribution+(m.is_ai_generated?' · AI 生成示意图':'')}}));if(n===generation)rows.value=next}catch{if(n===generation)error.value='配图暂时无法加载，请重试。'}}
watch(()=>props.postId,load,{immediate:true})
</script>
<template><InfoGallery v-if="post&&!rows.length" :title="post.title" :points="post.key_points.length?post.key_points:[post.short_summary]" :source="post.source_name+'。'+post.source_url"/><div v-if="rows.length||error" class="article-gallery"><figure v-for="m in rows" :key="m.id"><img :src="m.url" :alt="m.attribution" loading="lazy" @error="error='配图链接可能已过期，请重试。'"/><figcaption>{{m.attribution}}</figcaption></figure><button v-if="error" class="btn outline small" @click="load">{{error}}</button></div></template>
