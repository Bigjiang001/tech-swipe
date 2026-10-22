# 科技刷 TECH SWIPE · V0.01

手机优先的私人 AI 新闻阅读应用。每天一次集中发布；新闻数量可配，默认目标 20 条、范围 1–50 条。六个领域之外，重点提供 **GitHub 开源项目、Hugging Face 热门模型、大模型能力升级**的 AI 雷达。

本地已实现可操作的前台、演示互动，以及 Supabase 后端、API、Python Agent 和部署配置。**仓库不包含真实新闻、账号或任何生产凭证；没有配置云服务时不会自动产生新闻。** 实际执行结果和未联调事项见 [TEST_REPORT.md](TEST_REPORT.md)。

## 1. Mac 上启动

需要 Node.js 22+。当前仓库已经安装依赖，首次复制到其他设备时执行：

```bash
npm ci
npm run dev
```

打开终端显示的地址，点击「先体验演示版」。电脑也以 480px 手机阅读画布展示。支持向上/向下滑动、触控板/滚轮、方向键、详情底部面板、点赞、收藏、私人笔记、搜索、分类、关注和个人图文发布。

演示是明确标记的原创概念内容，插画也是本项目程序绘制，**不是实时新闻**。演示收藏、笔记、手记存于当前浏览器，刷新保留，跨设备不共享。配置 Supabase 并以所有者登录后，互动真正写入数据库。

生产构建默认关闭演示入口，并移除演示文章模块。不要把自己的私人内容加入 `src/data` 或 `public`。

手机在同一 Wi-Fi 下预览：执行 `npm run dev -- --host 0.0.0.0`，使用 Mac 的局域网 IP 加端口 5173。局域网 HTTP 下剪贴板可能受限；正式部署 HTTPS 后使用复制链接。可以在 Safari「添加到主屏幕」；应用不缓存私人正文到离线 Service Worker。

## 2. 目录与技术

```text
src/                       Vue 3 + TS + Pinia + Router + Tailwind + Lucide
  views/                   登录 / 刷新闻 / 发现 / 编辑 / 我的 / 管理
  stores/app.ts            演示与私人数据分离、会话和持久化
supabase/
  migrations/              表、RLS、服务端事务、AI 雷达扩展
  functions/               投稿、状态、发布、worker、管理员 API
  optional/cron.sql        可选 Supabase Cron + Vault 集成
agent/                     RSS / NewsAPI / GitHub / HF 采集、去重、中文制稿
scripts/                   API 联调、来源初始化、产物检查
.github/workflows/         Pages 部署、提前制稿、队列处理与集中发布
GPT_INTEGRATION.md         外部 Agent 与 ChatGPT 定时任务接入
```

复用了官方 Vue / Supabase 模式及成熟开源库，没有复制来源不明的新闻站代码。依赖来源和许可证见 [THIRD_PARTY.md](THIRD_PARTY.md)。

## 3. 初始化私人 Supabase

1. 创建你自己的 Supabase 项目。Auth 设置中关闭 **Allow new users to sign up**，关闭匿名登录；只保留需要的 Email Provider。不要在网站开放注册。
2. 在 Auth → Users 中创建一个所有者用户（或邀请后设置密码）。邮箱、密码由你在 Supabase 安全界面输入，不写进仓库。本站使用邮箱 + 密码登录，不实现公开注册或用前端管理员口令。
3. 将 `supabase/migrations/` 的全部 SQL 文件按文件名顺序在 SQL Editor 执行；或使用 CLI：

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

4. 从 Auth 用户列表复制该用户 UUID，在 **SQL Editor** 执行下面的初始化。替换占位 UUID 为你自己的真实 UUID，仅在控制台执行：

   ```sql
   begin;
   insert into private.app_owner(user_id) values ('YOUR_OWNER_UUID'::uuid);
   insert into public.profiles(id,display_name)
   values ('YOUR_OWNER_UUID'::uuid,'私人空间所有者');
   commit;
   ```

   `private.app_owner` 只有一个槽位，浏览器无法修改。其他 Auth 用户即使被创建，也不等于 owner，读不到数据。换 owner 应先完成私人数据迁移，不能简单开放第二账号。
5. 复制 `.env.example` 为 `.env`，填写项目 HTTPS URL 和 **publishable / anon key**。这是可公开项目标识，安全边界是 RLS 和真实会话。**service_role、模型密钥、投稿凭证不能使用 `VITE_` 前缀。**
6. Supabase Auth 的 Site URL 设置为最终 Pages URL；本地调试时把 `http://127.0.0.1:5173` 加入允许的重定向地址。重启 Vite，使用所有者邮箱和密码登录。
7. Storage 的 `private-media` 必须保持 Private。迁移已提供 owner 策略。图片通过 300 秒签名链接读取；持有未过期签名链接的人也可短暂取图，因此不要把签名图链接发给他人。退出会清空当前页面私人状态；Supabase 全局退出撤销刷新会话，已发出的 JWT 在其有效期内仍可能有效，可在 Auth 设置短有效期。

数据库包含任务书要求的 19 张业务表、私有 owner 与 nonce 表，以及外键、索引、唯一约束。所有公开业务表启用 RLS，并显式撤销 anon 权限。API 凭证哈希不可由前端 SELECT。操作日志、任务、核验数据不允许浏览器直接写入。

## 4. 部署 Edge Functions

```bash
npx supabase functions deploy news-ingest
npx supabase functions deploy news-job-status
npx supabase functions deploy news-publish-daily
npx supabase functions deploy news-worker
npx supabase functions deploy admin-control
```

`config.toml` 对这些函数设置 `verify_jwt=false`，因为它们分别执行 **函数内部 owner JWT 校验** 或 **带 HMAC 的专用凭证校验**，不是匿名 API。不要移除这些内部检查。

在 Supabase Edge Secrets 配置：

| 名称 | 用途 |
| --- | --- |
| `ALLOWED_ORIGINS` | 前端 origin，例如 `https://YOUR_NAME.github.io,http://127.0.0.1:5173`；没有仓库路径 |
| `VERIFY_BASE_URL` | 独立事实核验服务的 OpenAI-compatible `/v1` base |
| `VERIFY_API_KEY`、`VERIFY_MODEL` | 核验密钥和模型；仅在服务端保存 |
| `GITHUB_REPOSITORY` | 可选，`owner/repo`，后台立即执行使用 |
| `GITHUB_BRANCH` | 可选，默认 `main` |
| `GITHUB_DISPATCH_TOKEN` | 可选，限定该仓库 Actions write 的短期 fine-grained token；不要用无界限个人 token |

`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 由托管函数环境提供。不在客户端重复配置 service key。使用 Dashboard Secrets 输入或忽略的临时环境文件导入，避免 shell 历史记录中出现密钥。

未配置核验模型时，外部投稿只能成为待审核草稿，不会自动发布。核验模型不能保证绝对真实：重要财经、人物发言、争议事件仍应人工核对原始出处。

## 5. 接入新闻网站、GitHub 和 Hugging Face

进入「我的 → 新闻管理后台 → 信息源」，添加已确认允许自动读取的信息源，验证连接后启用。新增来源默认禁用。

- **RSS / Atom**：提取真实标题、合法摘要、日期与链接；不绕过付费墙，不抓取媒体全文再转载。标记「模型升级」后进入 AI 雷达。官方模型公告、模型卡、版本说明优先。
- **NewsAPI**：选择平台 API → NewsAPI，URL 使用 `https://newsapi.org/v2/...`，密钥只配置在 GitHub Secrets 的 `NEWSAPI_KEY`。不同服务套餐的许可由你核对。`content_hosts` 必须列出允许的原文域名。
- **GitHub**：API 适配器 GitHub；URL 为 `https://api.github.com/search/repositories`；原文域名 `github.com`。默认搜索近 7 天有更新、至少 50 累计 stars 的 LLM 主题项目，按累计 stars 排序。它是「高关注项目观察」，**不冒充 GitHub Trending，也不显示未测得的 24 小时涨幅**。可以在来源 URL 的 `q` 参数中改查询条件。
- **Hugging Face**：URL `https://huggingface.co/api/models`；适配器 Hugging Face；原文域名 `huggingface.co`；按平台 `trendingScore` 取候选，并保留下载/喜欢数的真实口径。不把下载量当成模型能力评分。
- **大模型升级**：添加官方 RSS 或 GitHub releases Atom，把「内容重点」设为模型能力 / 版本升级。厂商自测只作为厂商声称，不写成独立结论。

`agent/sources.example.json` 提供 GitHub、HF、OpenAI 与 Claude Code 的配置示例，**启用前核对当前可访问性和使用条款**。可以逐项在后台填写；也可通过 `scripts/import-sources.py` 用短期 owner 会话批量加入禁用来源，随后在后台逐项启用。此脚本不接受投稿令牌。

图片有两种策略：

1. 「原创示意图」：由程序绘制 SVG，明确标注非新闻现场，存入私有桶。
2. 「已授权实时图片」：必须填写已确认的图片许可与署名、允许的图片域名。服务端检查图片确实出现在来源文档 / RSS、HTTPS 与公共网络地址、类型和大小，然后导入私有 Storage。不能把来源网站有图当成可转载的授权。

第三方 API 令牌不保存在来源 URL 或数据库中。公开 GitHub / HF API 可无密钥使用；限流时任务失败留日志，不尝试绕过限制。

## 6. 无需保持浏览器打开的自动更新

前往后台 GPT 接口页面创建两种凭证：

- GPT / 外部 Agent：只有 `ingest,status`。
- GitHub 自动化：`ingest,status,worker,publish`，只放 GitHub Secrets。权限仍不包括读取私人正文、删库或修改设置。

凭证原文仅创建时显示一次，哈希保存在服务端，默认 90 天到期。轮换时生成新凭证 → 更新 Secrets → 测试 → 撤销旧凭证。退出接口页即清空显示，禁止截图分享凭证。

GitHub 仓库 → Settings → Secrets and variables → Actions，添加：

| Secrets | 内容 |
| --- | --- |
| `NEWS_API_URL` | `https://PROJECT.supabase.co/functions/v1` |
| `NEWS_AUTOMATION_TOKEN` | 自动化专用凭证 |
| `AI_BASE_URL` | OpenAI-compatible API base，含 `/v1`，不含 `/chat/completions` |
| `AI_API_KEY`、`AI_MODEL` | 你选择的供应商密钥和模型名称；不预设购买 |
| `NEWSAPI_KEY` | 可选，授权新闻 API |
| `HF_TOKEN`、`GH_READ_TOKEN` | 可选，公开元数据读取；GitHub 默认可用 workflow 的最小权限 `GITHUB_TOKEN` |

在 GitHub Actions Variables 添加 `NEWS_AUTOMATION_ENABLED=true` 才启用自动调度；关闭或删除该变量可暂停 runner，手动触发仍可测试。

在「我的」设置时区（默认 Asia/Tokyo，可选 Asia/Shanghai）、每日数量（1–50）、开启 Agent 和自动发布。建议先保持自动发布关闭，手动完成一次制稿、审核和接口联调。

流水线分开执行：

1. `news-prepare.yml`：UTC 22、23 时的 30–55 分钟每 5 分钟尝试一次。脚本只在服务端配置时区的 07:30–07:59 制稿；其他时刻跳过。支持后台 / workflow_dispatch 手动执行。数据库按本地日期锁定任务，已成功的日期不重复生成。失败可重试。
2. `news-publish.yml`：UTC 23、00 时的 00、05、10、20、35、50 分钟密集重试发布，另在每天每小时 17 分处理队列。两地 08:00 均有计划触发。服务端拒绝 08:00 前发布；只选择最近 48 小时内、核验通过的排队内容，在一个数据库事务里形成当天批次。制稿仍运行时先等待，空队列不占用当天名额。目标数量是上限，不强凑。
3. `supabase/optional/cron.sql`：可选，Vault 保存凭证，Cron 每分钟调用相同发布 API，可降低 Actions 延迟；同日唯一批次避免重复。它不负责生成新闻。文件中记录了停用命令。

所有工作流 cron **显式使用 UTC**，由服务端配置解释东京 / 上海日期；不依赖浏览器和 Mac 的时区。GitHub 支持时区化 schedule，但这里用统一 UTC + 服务端判断，改时区不必改工作流。普通 Actions 可能排队、延迟或丢失触发，**不承诺 08:00:00**；系统记录计划与实际发布时间。公开仓库长时间不活跃可能停用 schedule，注意 GitHub 提醒与 Actions 状态。频繁 worker 工作流会消耗 Actions 分钟，按账号配额决定是否采用可选 Cron 或后续独立常驻 worker。

同一天批次发布后，新到内容保留在草稿/队列供人工处理，不再自动追加第二批。人工单条发布属于明确的所有者操作。准备任务失败、不足来源、时间不明、核验不通过都留记录，不生成填充新闻。

## 7. GitHub Pages 部署

1. 在 GitHub 创建仓库，建议私有仓库（Pages 可用性以你的套餐为准）。将当前代码推送到 `main`。不要把 `.env`、账号和私人新闻导入 Git。
2. Settings → Pages → Build and deployment → Source 选 **GitHub Actions**。
3. Actions Variables 添加 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_ANON_KEY`，不要把任何后端密钥加到前端变量。
4. `.github/workflows/deploy.yml` 执行安装、类型检查、数据库/单元测试、Edge 测试、Python 测试、浏览器测试、生产构建，再部署 `dist`。
5. 仓库型站点 Vite base 自动为 `/仓库名/`。若仓库为 `用户名.github.io` 或使用根域名，把工作流 `VITE_BASE_PATH` 改成 `/`。
6. 路由采用 `/#/post/UUID`，刷新详情只请求静态入口，不会产生服务器详情路径 404。
7. 部署后在 Supabase Auth 和 `ALLOWED_ORIGINS` 填入正确 HTTPS 地址。手机打开 Pages URL 后登录。GitHub Pages 仅托管静态前端；API、正文、私人图片和所有服务端密钥仍在 Supabase / Secrets。

生产静态产物检查：

```bash
npm run build
node scripts/check-build.mjs
```

当前实例已部署至 https://bigjiang001.github.io/tech-swipe/ ，并连接独立 Supabase 私人后端。所有者已在控制台自行创建并绑定；公开注册已关闭。自动制稿仍须配置模型服务与自动化凭证，当前保持关闭。首次导入的资讯正文只保存在受 RLS 保护的数据库，不进入仓库或 Pages 产物。

## 8. 测试与运行边界

```bash
npm run typecheck
npm test                       # 真实 PostgreSQL 引擎 PGlite 的 RLS/事务测试
npm run check:edge             # Deno 类型检查，npm 已提供 Deno
npm run test:api                # 真实 HMAC + API handler，受控 PostgREST 模拟
python3 -m venv .venv
.venv/bin/pip install -r agent/requirements.txt
.venv/bin/python -m unittest discover -s agent/tests -v
npx playwright install chromium
npm run test:e2e                # iPhone / Android / 桌面手机画布
```

Mac 如已安装 Chrome，测试自动使用 Chrome；其他环境安装 Playwright Chromium。手机模拟测试不替代真实 iOS Safari / Android 手机验证。PGlite 不包括 Supabase 的 Auth、Storage 签名及托管网关；完整部署后按 [TEST_REPORT.md](TEST_REPORT.md) 的在线清单复验。

当前网页 API 适配器包括 RSS、NewsAPI、GitHub、HF；其他授权新闻供应商通过新增 Python adapter 接入。HTML 无法抓取、官方页面被反爬或日期无法核实的内容会失败或待审核。模型核验是带来源证据的自动辅助，不是绝对事实保证；特别重要或争议内容优先人工审核。

迁移至独立服务器时可保留静态前端与 Hash Router，将 Python 放入 cron/worker，继续调用同一 API；也可迁移 PostgreSQL 和 S3 存储。没有 Pages 端服务端代码。
