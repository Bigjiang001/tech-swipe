# 开源依赖与资料

本项目采用 npm / PyPI 的成熟开源实现；没有克隆并冒充其他项目源码，也不把第三方站点的图片或全文当成自有素材。

| 组件 | 仓库 | 许可证 |
| --- | --- | --- |
| Vue 3 / 官方脚手架参考 | https://github.com/vuejs/core / https://github.com/vuejs/create-vue | MIT |
| Vite | https://github.com/vitejs/vite | MIT |
| Pinia | https://github.com/vuejs/pinia | MIT |
| Vue Router | https://github.com/vuejs/router | MIT |
| Tailwind CSS | https://github.com/tailwindlabs/tailwindcss | MIT |
| Lucide | https://github.com/lucide-icons/lucide | ISC |
| Supabase JS / Edge 示例参考 | https://github.com/supabase/supabase-js / https://github.com/supabase/supabase/tree/master/examples/edge-functions | MIT / Apache-2.0，分别以各仓库 LICENSE 为准 |
| Zod | https://github.com/colinhacks/zod | MIT |
| feedparser | https://github.com/kurtmckee/feedparser | BSD-2-Clause |
| HTTPX | https://github.com/encode/httpx | BSD-3-Clause |
| PGlite | https://github.com/electric-sql/pglite | Apache-2.0 / PostgreSQL 相关分发许可 |
| Playwright | https://github.com/microsoft/playwright | Apache-2.0 |
| Vitest | https://github.com/vitest-dev/vitest | MIT |
| Deno | https://github.com/denoland/deno | MIT |

实际安装版本由 package-lock.json 与 agent/requirements.txt 记录，具体分发许可证保存在依赖的 LICENSE 文件。图标来自 Lucide；所有 public/covers SVG 由 scripts/create-covers.py 原创绘制，没有下载新闻照片。

实现时核对的官方资料：

- https://vuejs.org/guide/typescript/overview
- https://tailwindcss.com/docs/installation/using-vite
- https://supabase.com/docs/guides/database/secure-data
- https://supabase.com/docs/guides/storage/buckets/fundamentals
- https://supabase.com/docs/guides/functions/function-configuration
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories
- https://huggingface.co/docs/hub/en/api
- https://learn.chatgpt.com/docs/automations

外部新闻源、图片与模型权重的许可独立于本项目代码，不能由上述依赖的开源许可推导。
