import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import Login from './views/Login.vue'
import Feed from './views/Feed.vue'
import Library from './views/Library.vue'
import Editor from './views/Editor.vue'
import Account from './views/Account.vue'
import Admin from './views/Admin.vue'
import Inbox from './views/Inbox.vue'
import Listen from './views/Listen.vue'
import Connect from './views/Connect.vue'
import { useApp } from './stores/app'
import './style.css'
const pinia=createPinia()
export const router=createRouter({history:createWebHashHistory(),routes:[{path:'/login',component:Login},{path:'/',component:Feed},{path:'/post/:id',component:Feed},{path:'/discover',component:Library},{path:'/bookmarks',component:Library},{path:'/publish',component:Editor},{path:'/edit/:id',component:Editor},{path:'/account',component:Account},{path:'/admin',component:Admin},{path:'/inbox',component:Inbox},{path:'/listen',component:Listen},{path:'/connect',component:Connect},{path:'/:pathMatch(.*)*',redirect:'/'}]})
router.beforeEach(async to=>{const app=useApp(pinia);await app.initialize();if(!app.authenticated&&to.path!=='/login')return {path:'/login',query:{redirect:to.fullPath}};if(app.authenticated&&to.path==='/login')return '/'})
createApp(App).use(pinia).use(router).mount('#app')
