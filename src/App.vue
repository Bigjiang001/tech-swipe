<script setup lang="ts">
import { computed,watch,onMounted,onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApp } from './stores/app'
import Icon from './components/Icon.vue'
import Brand from './components/Brand.vue'
const app=useApp(),route=useRoute(),router=useRouter()
watch(()=>app.authenticated,authorized=>{if(!authorized&&app.ready)router.replace('/login')})
function shortcut(e:KeyboardEvent){if((e.metaKey||e.ctrlKey)&&e.key==='k'&&app.authenticated){e.preventDefault();router.push({path:'/discover',query:{focus:'1'}})}}
onMounted(()=>document.addEventListener('keydown',shortcut));onUnmounted(()=>document.removeEventListener('keydown',shortcut))
const login=computed(()=>route.path==='/login')
const nav=[{to:'/',label:'今日推荐',icon:'House'},{to:'/discover',label:'发现世界',icon:'Compass'},{to:'/bookmarks',label:'我的收藏',icon:'Bookmark'},{to:'/account',label:'我的空间',icon:'UserRound'}]
const date=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date())
</script>
<template>
 <div v-if="login" class="login-wrap"><RouterView/></div>
 <div v-else class="app-shell">
  <aside class="sidebar">
   <RouterLink to="/" aria-label="科技刷首页" class="logo-link"><Brand/></RouterLink>
   <div class="sidebar-label">你的每日信息宇宙</div>
   <nav class="side-nav"><RouterLink v-for="n in nav" :key="n.to" :to="n.to" :class="{active:route.path===n.to||(n.to==='/'&&route.path.startsWith('/post/'))}"><Icon :name="n.icon"/><span>{{n.label}}</span><span v-if="n.to==='/'" class="nav-dot"></span><small v-if="n.to==='/bookmarks'&&app.bookmarks.length">{{app.bookmarks.length}}</small></RouterLink></nav>
   <RouterLink to="/publish" class="publish-side"><Icon name="Plus" :size="18"/>记录一个发现</RouterLink>
   <RouterLink to="/inbox" class="admin-link"><Icon name="Rss"/>链接收件箱</RouterLink><div class="sidebar-divider"></div>
   <div class="sidebar-label">工作台</div>
   <RouterLink to="/admin" class="admin-link" :class="{active:route.path==='/admin'}"><Icon name="SlidersHorizontal"/>新闻管理<Icon name="ArrowUpRight" :size="16"/></RouterLink>
   <div class="side-bottom">
    <div class="daily-note"><span class="tiny-orange">LESS NOISE. MORE SIGNAL.</span><div>世界很大，<br>每天读懂一点。</div><span class="orbit-mini">✳</span></div>
    <RouterLink to="/account" class="owner-card"><span class="avatar">Y<span></span></span><span><strong>{{app.demo?'好奇心研究员':'私人阅读空间'}}</strong><small>{{app.demo?'演示模式 · 本机保存':'OWNER · 仅你可见'}}</small></span><Icon name="Settings2" :size="17"/></RouterLink>
   </div>
  </aside>
  <div class="main-shell">
   <header class="topbar"><div class="topbar-greeting"><span class="status-dot"></span><span>为好奇心，留一点时间。</span><small>{{date}}</small></div><RouterLink to="/" class="mobile-brand"><Brand/></RouterLink><div class="topbar-tools"><button aria-label="搜索新闻、主题、来源" class="search-trigger" @click="router.push({path:'/discover',query:{focus:'1'}})"><Icon name="Search" :size="17"/><span>搜索新闻、主题、来源</span><kbd>⌘ K</kbd></button><RouterLink to="/account" class="icon-btn" aria-label="设置"><Icon name="Settings2"/></RouterLink></div></header>
   <div v-if="app.demo" class="demo-ribbon"><span><span class="demo-dot"></span> 交互演示 · 内容为虚构示例，不构成新闻报道</span><RouterLink to="/account">连接私人空间 <Icon name="ArrowUpRight" :size="13"/></RouterLink></div>
   <main><RouterView/></main>
   <nav class="mobile-nav" aria-label="底部导航"><RouterLink to="/"><Icon name="House"/><span>首页</span></RouterLink><RouterLink to="/discover"><Icon name="Compass"/><span>发现</span></RouterLink><RouterLink to="/publish" class="mobile-plus" aria-label="发布"><Icon name="Plus"/></RouterLink><RouterLink to="/bookmarks"><Icon name="Bookmark"/><span>收藏</span></RouterLink><RouterLink to="/account"><Icon name="UserRound"/><span>我的</span></RouterLink></nav>
  </div>
 </div>
 <Transition name="toast"><div v-if="app.toast" class="toast-message" role="status"><Icon name="CircleCheck" :size="18"/>{{app.toast}}</div></Transition>
</template>
