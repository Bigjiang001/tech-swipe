<script setup lang="ts">
import {useApp} from '../stores/app'
const app=useApp()
const endpoint=(import.meta.env.VITE_SUPABASE_URL||'https://wdtziusllexbanevxknz.supabase.co')+'/functions/v1/gpt-bridge'
const testPrompt='请检查是否有已授权的科技刷 submit_links 和 get_link_status 工具。如有，请查找一条最近24小时的官方模型升级公告，核对日期后，提交原始 HTTPS 地址、中文标题、入选理由和标签，再查询返回的真实链接 ID。没有工具则明确说尚未上传，不虚构成功或索取密钥。'
const dailyPrompt='每天北京时间08:00（Asia/Shanghai），为我的科技刷收集最新资料。优先官方大模型能力升级、GitHub AI/Agent项目和Hugging Face模型，最近24小时为主，必要时48小时，不凑数、同一事件去重。核对原始出处和日期，用已授权的submit_links提交HTTPS原始链接、中文标题、入选理由、分类和标签，每批最多20条，再用get_link_status查询真实状态。累计stars和下载量不当作今日增长或性能，旧项目不当作今天发布。仅在明确有使用许可时用upload_link_image上传图片并注明许可，否则只提交链接。不读取私人笔记，不直接发布，不索取密钥。报告新增、重复、失败和真实回执。若定时运行没有工具或授权，明确报告尚未上传。08:00是开始采集时间，不是完成发布时间。'
async function copy(value:string){try{await navigator.clipboard.writeText(value);app.notify('已复制')}catch{app.notify('复制未成功，请长按选中文本复制')}}
</script>
<template><details class="form-card gpt-setup"><summary>GPT 投稿连接设置与任务提示词</summary><p>接口已部署；你的 ChatGPT 账号仍需添加连接并授权。提示词本身不能授予上传权限。</p><label>MCP 连接地址<input readonly :value="endpoint" aria-label="GPT连接地址"/></label><button class="btn outline small" @click="copy(endpoint)">复制连接地址</button><ol><li>在支持自定义 MCP 应用的 GPT 环境添加上面的地址。</li><li>在跳转的科技刷页面登录所有者账号，确认授权。</li><li>先在普通聊天测试上传与状态查询，再测试一次定时运行。定时任务可能不支持同样的工具。</li></ol><h3>先测试一次</h3><p class="gpt-prompt">{{testPrompt}}</p><button class="btn outline small" @click="copy(testPrompt)">复制测试提示词</button><h3>每日收集资料</h3><p class="gpt-prompt">{{dailyPrompt}}</p><button class="btn outline small" @click="copy(dailyPrompt)">复制每日任务提示词</button><p class="form-hint">本页面不会自动创建 ChatGPT 任务。若账号不支持连接或定时调用，科技刷自身的云端快讯采集仍独立运行。08:00 前要准备好资料，可将启动时间改为07:20。</p><RouterLink to="/admin" class="source-link">到管理后台撤销连接凭证</RouterLink></details></template>
