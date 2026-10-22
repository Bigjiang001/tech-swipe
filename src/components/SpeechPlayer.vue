<script setup lang="ts">
import { watch } from 'vue'
import { useSpeech } from '../lib/speech'
import { useApp } from '../stores/app'
import Icon from './Icon.vue'
const props=defineProps<{title:string;text:string}>(),speech=useSpeech(),app=useApp()
watch(()=>props.text,()=>speech.stop());watch(()=>app.authenticated,value=>{if(!value)speech.stop()})
</script>
<template><section class="speech-player" @wheel.stop @touchstart.stop @touchend.stop><div class="speech-controls"><button class="btn outline small" :disabled="!speech.supported" @click="speech.playing.value||speech.paused.value?speech.toggle():speech.start(title+'。'+text)"><Icon :name="speech.playing.value?'Pause':'Play'" :size="16"/>{{speech.playing.value?'暂停':speech.paused.value?'继续':'听这条'}}</button><button v-if="speech.playing.value||speech.paused.value" class="icon-btn" aria-label="停止朗读" @click="speech.stop"><Icon name="X" :size="16"/></button><select :value="speech.rate.value" aria-label="朗读速度" @change="speech.changeRate(Number(($event.target as HTMLSelectElement).value))"><option :value="0.8">0.8×</option><option :value="1">1×</option><option :value="1.2">1.2×</option><option :value="1.5">1.5×</option></select></div><small>{{speech.supported?'系统朗读 · 暂停后从当前段恢复 · 锁屏播放依设备而定':'当前浏览器不支持系统朗读'}}</small><p v-if="speech.error.value" class="form-error">{{speech.error.value}}</p></section></template>
