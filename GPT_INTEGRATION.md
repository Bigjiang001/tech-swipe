# GPT / 外部 AI Agent 接入科技刷

本项目采用两个独立入口：受信任 Agent 投稿，以及 GitHub Actions 直接采集网站 / GitHub / Hugging Face 的无人值守流水线。两者进入相同持久队列、独立核验和发布事务。

## ChatGPT 定时任务的职责

可以安排它搜索近 24 小时（必要时 48 小时）的科技、AI、财经、人文、社会和艺术资料，重点关注 GitHub 开源项目、Hugging Face 热门模型、大模型升级；提供原始链接、真实日期、中文原创摘要、事实与推测边界，以及图片使用权限说明。没有足够可靠资料时跳过。

云端定时任务能否调用写入工具，取决于当前计划、工作区、已授权连接、工具动作及审批配置。**不能因为能定时研究，就推定能任意发送带密钥的 HTTP POST。** 本地项目型任务可能需要电脑和 App 运行，因此它不承担本项目每日更新的唯一执行责任。背景和权限要求参见 [OpenAI 定时任务文档](https://learn.chatgpt.com/docs/automations) 和 [云端连接与权限说明](https://learn.chatgpt.com/docs/enterprise/chatgpt-work-cloud-security)。

集成步骤：先在普通聊天里做一次完整研究 → 使用已授权工具测试一次提交 → 确认服务端返回 job_id → 检查草稿、来源和日志 → 再建立定时任务。当前交付没有替你创建 ChatGPT 自动任务，也没有假定你的账号已经具备相应工具。

## 安全接入的三种路径

1. **已授权连接器 / MCP 工具**：工具在服务端保管仅投稿凭证，对 ChatGPT 暴露 `submit_news(batch)` 和 `get_submission(job_id)` 两个最小动作。连接器负责授权用户、签名、限流。不要暴露通用 URL fetch、service role、发布或删库动作。此仓库提供下游 API 与签名客户端；具体 ChatGPT 连接器需要在你的实际工作区注册和授权，未伪造一个已连接的工具。
2. **受控桥接服务**：你自己的服务器验证 OAuth / 平台签名后，把 JSON 交给 `agent.api.API`。凭证在服务端 Secret Manager。桥接校验来源、请求大小和 JSON，不允许通过请求覆盖 API host 或注入密钥。不提供匿名上传网页。
3. **GitHub 工作流**：ChatGPT 使用已授权 GitHub 工具提交经过检查的研究结果到受限的私人中转位置，或手动把 JSON 放入安全 runner 输入；受控 workflow 使用 GitHub Secrets 运行 `scripts/api-test.py` / `agent.api.API`。不要把个人研究内容提交到将被 Pages 打包的目录。若没有已验证的写入工具，ChatGPT 只输出研究材料，本项目现有 RSS / 平台 API 工作流继续独立运行。

不要把投稿令牌、owner JWT、模型 API Key、GitHub PAT 放在自然语言任务、聊天附件、公开 Issue、源码、前端环境变量或定时任务普通文本中。提供给 GPT 的任务只写工具名、目标和内容规则。

## 创建与轮换凭证

所有者登录 → 我的 → 新闻管理后台 → GPT 接口 → 选择「仅投稿」→ 生成凭证。服务端产生 256 位随机 secret，存 SHA-256 哈希，原文只在创建响应中返回。格式为 `tsw.<client_uuid>.<64位hex secret>`，默认 90 天有效。

- GPT 凭证范围：`ingest,status`。
- GitHub runner 凭证范围：`ingest,status,worker,publish`。
- 投稿者不能读取私人正文、评论、图片、系统设置，也不能直接发布新闻。
- 轮换：新建 → 更新桥接或 Secrets → 做一次成功投稿 → 撤销旧凭证。撤销后新请求即时被拒绝。凭证不允许重新显示，只能重新生成。

## 接口与签名协议

基础地址 `https://PROJECT.supabase.co/functions/v1`。

| 方法与路径 | 最小权限 | 行为 |
| --- | --- | --- |
| POST `/news-ingest` | ingest | 验证整批结构并放入持久队列，返回 202 + job_id |
| GET `/news-job-status?job_id=UUID` | status | 只返回该 client 自己任务的状态与安全结果 |
| POST `/news-publish-daily` | publish | 接受 `{}`；服务端决定当天、08:00、核验和单次批次 |
| POST `/news-worker` | worker | GitHub 专用；处理队列 / 获取源配置 / 记录受控运行信息 |

请求头：

```text
Authorization: Bearer tsw.<id>.<secret>
Content-Type: application/json
X-TS-Timestamp: <10位 Unix 秒>
X-TS-Nonce: <新 UUID>
X-TS-Signature: <HMAC-SHA256 hex>
```

签名的精确 UTF-8 字符串为五行，最后不加换行：

```text
METHOD
/functions/v1/news-ingest
TIMESTAMP
NONCE
SHA256_HEX_OF_EXACT_BODY_BYTES
```

第二行包含 query string，按实际发送顺序，不含 origin。GET 的 body 是空字节，不能签成 `{}`。HMAC key 是令牌最后一段的 **UTF-8 hex 文本**，不是 hex 解码后的二进制。请求正文签名后不得再格式化。

服务端验证哈希、scope、撤销、过期和 HMAC，允许 ±300 秒时钟误差，再由数据库原子保留 nonce。每 client 每分钟最多 60 个已验证请求。重复 nonce 返回 409；重复的业务提交应使用**新 nonce、同一 idempotency_key 和完全相同的 payload**。

调用方无需自己实现签名：`agent/api.py` 已实现，也带有限重试和安全日志。HTTP 429 / 5xx / 网络失败会有限重试；每次生成新 nonce。没有投稿密钥时不要试图通过 anon key 投稿。

## 严格新闻 JSON

实际 Schema 由 `supabase/functions/_shared/schema.ts` 定义；未知字段会拒绝。正文必须为中文原创表达。一次提交 1–10 条；每日目标可达 50，通过多批上传、一次发布完成。

```json
{
  "idempotency_key": "research-2026-10-22-part-01",
  "posts": [{
    "external_id": "stable-event-identifier",
    "idempotency_key": "stable-event-identifier",
    "content_kind": "news",
    "title": "至少八字的中文标题，必须基于真实资料",
    "category": "AI",
    "short_summary": "50–100 字左右的真实原创摘要；Schema 范围 50–300 字。",
    "medium_summary": "150–250 字左右；Schema 范围 150–1000 字。",
    "full_content": "300–600 字左右的背景与分析；Schema 范围 300–6000 字。",
    "key_points": ["第一个可核对的核心事实", "第二个可核对的核心事实", "第三个可核对的核心事实"],
    "source_name": "原始机构名称",
    "source_url": "https://example.org/original-announcement",
    "source_published_at": "2026-10-22T07:00:00+09:00",
    "event_time": null,
    "tags": ["模型升级"],
    "image_url": null,
    "image_attribution": "",
    "is_ai_generated_image": false,
    "verification_status": "pending",
    "generated_at": "2026-10-22T07:40:00+09:00",
    "submitted_by": "authorized-research-agent",
    "evidence_urls": []
  }]
}
```

这是字段说明示例，摘要长度和 `example.org` 不是可直接发布的新闻，不要作为真实投稿使用。`content_kind` 可为 `news`、`project`、`model_update`。项目观察的时间指指标采集时间，不能把旧项目写成今天发布；仓库创建时间保留在内容中并明确区分。

`verification_status` 永不直接采信。投稿也不能包含 published/status 等发布字段。服务端独立抓取批准的源；自动核验须满足：官方来源、可访问证据、精确引用命中、日期相符、核验模型支持。普通媒体来源先保留为待人工审核草稿。提供多个链接不等于完成独立核验。

配图不会直接热链到前台：仅在已确认授权和域名白名单范围内导入；否则生成原创程序示意图。调用方声称“AI 配图”不能绕过来源与版权检查。所有私人图片由私有桶签名读取。

## 一次测试、一批提交与失败重试

1. 配置一个**独立测试用、可撤销**的 ingest token 到本机安全环境（或测试 runner Secrets），以及 `NEWS_API_URL`。不要通过命令行参数输入令牌。
2. 从最近 48 小时的真实批准来源整理一条完整 JSON，放在受控本地 `batch.json`，不要放进 `public/` 或公开 Git。
3. 执行：

   ```bash
   python3 scripts/api-test.py /private/path/batch.json --repeat
   ```

   第一次应返回 202、job_id、pending；第二次新签名返回相同 job_id、duplicate=true。脚本再查询状态。后台「GPT 接口」应出现 accepted 日志。
4. GitHub worker 下次触发后处理持久队列。单次 worker 调用只核验一条，使用数据库 lease，进度保存在服务端；进程中断后能接续。job_id 返回 succeeded 只说明草稿处理完毕，**不意味着全部核验通过或已经发布**；去后台查看每条核验状态。
5. 批量提交：将资料按每批最多 10 条拆分，每批稳定 idempotency_key；每事件稳定 external_id。更改已提交内容应使用新批次 key，不要复用旧 key 改 payload；原事件 URL / 每日项目快照还有数据库去重。
6. 网络失败：复用相同 batch payload 与业务 key，以新 nonce 重试。遇 401 / 403 先修正凭证、scope、到期或时钟，不盲目重试。422 修正结构或等待人工核验；409 判断是重放、业务重复还是内容冲突。失败任务可在后台查看原因后重试。
7. 验证错误密钥：在隔离测试环境使用独立无效 token，应返回 401；撤销测试 token 后同样应被拒绝。不要修改生产 token 来“试错”。

仓库已运行 `npm run test:api` 的模拟请求，覆盖成功、错误密钥、撤销、权限、防重放、幂等、冲突和字段拒绝。它使用真实签名与 handler、模拟 PostgREST；上线后仍需运行上述真实实例联调。

## 可放进 ChatGPT 的无密钥任务描述

> 每天 07:20（Asia/Tokyo）研究科技刷新闻。优先关注 GitHub 高关注 AI 开源项目、Hugging Face 热门模型及主要大模型能力升级，同时覆盖科技、财经、社会、人文和艺术。以最近 24 小时为主，必要时 48 小时。保留原始日期、链接和图片许可，区分官方声称、独立测评和你的分析。没有证据就跳过，不凑数量。按约定 JSON Schema 输出原创中文资料。如果当前任务有已授权的科技刷投稿工具，只提交草稿并记录 job_id；否则输出研究结果并说明尚未上传，不尝试索取、打印或在提示词中保存任何密钥。不要自行发布。

这是待你在实际账号里验证的任务模板，不代表已创建计划。可靠的每日执行仍由 GitHub Actions 与可选 Supabase Cron 完成。


## 可直接复制的完整定时任务提示词

见 [SCHEDULED_NEWS_PROMPT.md](SCHEDULED_NEWS_PROMPT.md)。该版本按最新要求写为北京时间 08:00 开始研究，同时明确：若要 08:00 即可阅读，应改为 07:20 先准备；现有单日单批发布不会自动追加较晚的投稿。
