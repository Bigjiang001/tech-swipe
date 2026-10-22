import { ref,onUnmounted } from 'vue'
export function useSpeech(){
 const supported=typeof window!=='undefined'&&'speechSynthesis' in window,playing=ref(false),paused=ref(false),rate=ref(1),index=ref(0),total=ref(0),error=ref('')
 let chunks:string[]=[],active:SpeechSynthesisUtterance|null=null,generation=0,ended:(()=>void)|undefined
 function stop(){generation++;if(supported)window.speechSynthesis.cancel();active=null;playing.value=false;paused.value=false}
 function speak(){if(!supported||index.value>=chunks.length){playing.value=false;ended?.();return}const n=generation;const utterance=new SpeechSynthesisUtterance(chunks[index.value]!);active=utterance;utterance.lang='zh-CN';utterance.rate=rate.value;const voices=window.speechSynthesis.getVoices();const voice=voices.find(v=>v.localService&&/^zh/.test(v.lang))||voices.find(v=>/^zh/.test(v.lang));if(voice)utterance.voice=voice;utterance.onend=()=>{if(n!==generation)return;index.value++;speak()};utterance.onerror=e=>{if(n!==generation)return;playing.value=false;error.value=e.error==='not-allowed'?'请再次点击朗读，允许设备开始播放。':'设备朗读暂时不可用，请检查系统语音设置。'};playing.value=true;window.speechSynthesis.speak(utterance)}
 function start(text:string,onEnd?:()=>void){stop();error.value='';if(!supported){error.value='当前浏览器不支持系统朗读。';return}chunks=(text.match(/[^。！？\n]+[。！？\n]?/g)||[]).flatMap(s=>s.match(/.{1,180}/gu)||[]);index.value=0;total.value=chunks.length;ended=onEnd;speak()}
 function toggle(){if(!playing.value&&!paused.value)return;if(playing.value){generation++;window.speechSynthesis.cancel();playing.value=false;paused.value=true}else{paused.value=false;speak()}}
 function changeRate(value:number){rate.value=value;if(playing.value){generation++;window.speechSynthesis.cancel();speak()}}
 onUnmounted(stop)
 return {supported,playing,paused,rate,index,total,error,start,toggle,stop,changeRate}
}
