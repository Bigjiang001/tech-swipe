<script setup lang="ts">
import {computed,ref} from 'vue'
import {infoImages} from '../lib/info-images'
const props=defineProps<{title:string;points:string[];source:string}>(),track=ref<HTMLElement>(),selected=ref(0)
const images=computed(()=>infoImages(props.title,props.points,props.source))
function go(i:number){track.value?.scrollTo({left:i*track.value.clientWidth,behavior:'smooth'})}
</script>
<template><section class="info-gallery" aria-label="新闻信息图"><div ref="track" class="info-gallery-track" @wheel.stop @touchstart.stop @touchend.stop @scroll="selected=Math.round(($event.target as HTMLElement).scrollLeft/($event.target as HTMLElement).clientWidth)"><figure v-for="(image,i) in images" :key="i"><img :src="image.url" :alt="image.caption"/><figcaption>{{image.caption}}</figcaption></figure></div><div class="gallery-navigation"><button v-for="(_,i) in images" :key="i" :aria-label="`查看第 ${i+1} 张信息图`" :aria-pressed="selected===i" @click="go(i)">{{i+1}}</button><small>左右滑动 · {{selected+1}} / {{images.length}}</small></div></section></template>
