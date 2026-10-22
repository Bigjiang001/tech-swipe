# 科技刷 V0.01 测试记录

执行日期：2026-10-22（Asia/Shanghai）。本文件区分本地测试、受控模拟和未完成的云端联调；不将编译成功等同于线上系统已经运行。

## 实际执行

| 检查 | 结果 | 覆盖范围 |
| --- | --- | --- |
| `npm run typecheck` / `npm run build` | 通过 | Vue / TypeScript 和静态产物 |
| `npm test` | 16 项通过 | 真实 PostgreSQL 引擎 PGlite 的 RLS、grants、存储对象策略、收藏/评论写入、凭证列保护、服务端 RPC 隔离、owner 手动发布、不可伪造核验、nonce、幂等、队列 lease、单日发布、08:00 前拒绝、计划时区 |
| `npm run test:api` | 12 项通过 | 真实 WebCrypto HMAC、实际 Edge handler、受控 PostgREST/Storage/网页模拟；成功投稿、错误/撤销凭证、scope、过期签名、防重放、重复、冲突、字段/URL 拒绝；坏来源不阻塞剩余内容；不采信调用方 verified |
| Python unittest | 11 项通过 | RSS 真实日期解析、去重、48h 新鲜度、可超过十条、无来源不造新闻且失败落日志、暂停、签名、内网 URL 拒绝、GH/HF 指标口径 |
| Playwright | 24 项通过 | iPhone 390×844、Android 360×740、桌面窄屏，共 8 场景 × 3；匿名登录门禁、无横向溢出、底栏不遮卡、方向键、桌面滚轮、模拟触摸滑动、详情滚动隔离、收藏/笔记刷新保存、搜索/分类/关注、手记发布、退出、详情 Hash 刷新、AI 雷达 |
| `VITE_BASE_PATH=/tech-swipe/ npm run build` | 通过 | 仓库子路径静态构建 |
| `node scripts/smoke-pages.mjs` | 通过 | 实际启动生产 preview，用 Chrome 访问 `/tech-swipe/`，资源无 404、无 JS 错误、生产无演示入口、直接详情及刷新返回登录 |
| `node scripts/check-build.mjs` | 通过 | 生产 JS 不含演示文章、正文编辑部标识或服务端配置变量名 |
| `npm run check:edge` | 通过 | 五个 Edge Function 的 Deno 类型检查 |
| npm production audit | 0 已知漏洞 | 使用 npm 官方 registry；只涵盖安装的前端生产依赖，不代表整个系统没有安全问题 |
| GitHub Search API | HTTP 200 | 实际请求公开接口，确认仓库字段结构；未发布这些真实数据 |
| Hugging Face Models API | HTTP 200 | 实际请求 trendingScore 排序，确认模型字段结构；未发布这些真实数据 |

合计 **63 项自动化测试**（16 + 12 + 11 + 24），另有构建、类型、生产冒烟及公开接口检查。最新格式化日期回归测试单独加入并执行；浏览器测试在前台主要逻辑完成后完整跑过，之后仅有计划时间显示和 Agent 编辑后跳转的局部修正。

前期测试揭示并已修正：测试触摸事件缺少 identifier、刷新后详情面板拦截测试点击、HF 域名过滤误收普通文章、跨时区计划显示、坏来源阻塞整批等问题。完整日志可通过上方命令重现；浏览器报告在忽略的 `playwright-report/`，截图在 `docs/screenshots/`。

## 验证的实际边界

- PGlite 使用 PostgreSQL 的 RLS、角色与事务引擎；`auth.users` / `auth.uid()` / `storage.objects` 为可控兼容测试表，**没有启动托管 Supabase Auth 和 Storage 服务**。本机 Docker daemon 未运行。
- API 与 worker 测试运行实际 handler 和签名代码，但 PostgREST、Storage 和来源网页由受控 HTTP fixtures 替代，**不是已部署项目的端到端成功证明**。
- Playwright 使用本机 Chrome 的移动设备模拟，不是实体 iPhone Safari；触摸事件测试也不等于真实手指惯性手势测试。Mac 触控板硬件仍需人工体验。
- 未配置模型密钥，所以没有付费调用任何 AI 服务，也没有生成或发布“假真实新闻”。自动事实核验为辅助模型，不作绝对准确保证。
- 没有用户的 Supabase / GitHub 云配置，**没有部署 Pages、部署函数、创建线上 owner 或启用真实定时工作流**。GitHub 工作流在云端是否有权限、Supabase 计费/配额及源站许可需配置后验证。
- Supabase Cron 的可选 Vault / pg_net 脚本未在托管实例运行；需要启用相应扩展并配置安全 Vault secrets。

## 配置后在线验收清单

1. 关闭公开与匿名注册、初始化唯一 owner；owner 可以登录，另一真实 Auth 用户读取 posts 为空或被拒绝。
2. 匿名 REST 不可读私人正文；未签名 Storage URL 不可取图；短期签名按有效期工作。不要把持有有效签名 URL 的人也能取图误判为 RLS 失效。
3. 两台设备验证收藏、笔记、关注与手记同步；退出当前页面清空内容，刷新会话撤销符合 Supabase 会话语义。
4. 用独立测试令牌运行 `scripts/api-test.py ... --repeat`；确认 job_id 相同，修改 payload 复用 key 返回冲突，错误或撤销令牌拒绝。
5. 分别跑一次 RSS、GitHub、HF、官方模型升级来源；检查原始日期、指标采集时间、许可证、模型生成及独立核验结果。被阻拦/反爬的网页应停在失败或待审核，不能编造。
6. 手动触发制稿，检查 raw_news、agent_jobs、agent_runs 和后台日志；未核验内容不在首页。
7. 发布前保持 auto_publish=false，人工核对首批；再设置 Asia/Tokyo / Shanghai 的 08:00，确认计划和实际时间。并发触发 Actions / 可选 Cron，publishing_batches 同日只有一条。
8. 模拟模型失败、来源缺失及图片下载失败：任务有错误日志、后续好内容仍可处理、无授权图片使用标注示意图。
9. Pages 生产 URL 真机测试滑动、键盘/滚轮、浏览器返回、详情刷新、弱网、会话过期、剪贴板和主屏幕模式。


## 云端部署复验（2026-10-22，北京时间）

- GitHub Pages 已启用并返回正式静态入口；GitHub Actions 类型检查、单元/API/Agent/浏览器测试和构建通过。
- Supabase 已部署数据库迁移和 5 个 Edge Functions；19 张业务表均启用 RLS。
- 无会话直接读取 posts 返回 401/权限拒绝；公开 Storage 路径不可读取私有桶。无凭证投稿、状态、发布和管理请求返回 401。
- 托管环境默认函数权限额外向 anon 授权的问题已用追加迁移撤销，并复查为 false。
- 数据库角色测试：owner 可见自己的 profile；非 owner 的 authenticated 身份看不到 profiles 或来源。
- 生产前端已由所有者亲自设置密码并完成实际登录。
- Auth 已关闭公开注册和匿名登录；Site URL 与函数 CORS 已指向正式域名。
- 尚未配置模型 API 密钥及自动化凭证，自动制稿/自动发布保持关闭；不可声称每日更新已启用。
