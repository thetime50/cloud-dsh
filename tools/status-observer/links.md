# 状态页 / 监控相关链接

## FlashDuty

- 监听/探测：本机 status-observer
- 记数据：FlashDuty（组件状态 / 故障事件）
- 提供页面：FlashDuty 状态页（play-site-dsh）

- [状态页变更创建 API](https://docs.flashduty.com/zh/api-reference/on-call/status-pages/status-page-change-create)
- [AppKey 管理](https://console.flashcat.cloud/profile/appkey)
- [状态页 play-site-dsh](https://statuspage.flashcat.cloud/play-site-dsh)

## UptimeFlare / Cloudflare

- 监听/探测：Cloudflare Worker（边缘定时拉目标）
- 记数据：Cloudflare D1（latency / incident）
- 提供页面：Cloudflare Pages（uptimeflare-56u.pages.dev）

- [UptimeFlare 文档 Wiki](https://github.com/lyc8503/UptimeFlare/wiki)
- [Cloudflare API 令牌](https://dash.cloudflare.com/profile/api-tokens)
- [UptimeFlare-Cloud-DSH 仓库](https://github.com/thetime50/UptimeFlare-Cloud-DSH)
- [UptimeFlare 状态页](https://uptimeflare-56u.pages.dev/)

## Uptime Kuma

- 监听/探测：本机 Uptime Kuma 服务（主动探站点）
- 记数据：本机 Uptime Kuma（含延迟历史）
- 提供页面：本机控制台 / 状态页（局域网可访问即可）
- 命令 Demo（`cd tools/uptime-kuma`）：
  - `node kuma.mjs deploy` — 启动容器，首次打开页面创建管理员
  - `node kuma.mjs import ./monitors.json` — 从指定 JSON 导入本机库（可先复制 `monitors.example.json`）
  - `node kuma.mjs export ./monitors.json` — 导出到指定 JSO

- [本机控制台](http://127.0.0.1:3002/)（端口 3002）N
- [GitHub 仓库](https://github.com/louislam/uptime-kuma)
- [官网 / 文档](https://uptime.kuma.pet/)
- [公开状态页 Demo](https://status.kuma.pet/)

