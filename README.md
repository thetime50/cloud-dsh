# cloud-dsh

一个容器里跑多个 DSH 实例。对外只有 gateway。

```bash
pnpm install
pnpm test
pnpm smoke
```

启动：

```bash
CLOUD_DSH_ADMIN_TOKEN=... CLOUD_DSH_PLAY_SITE_URL=http://xx.yy.com pnpm start
```

实例页面是 `http://dsh.xx.yy.com/i/<实例 id>/`。主站用 cookie `play_site_token` 确认这次实例、用户和登录。管理接口带 `Authorization: Bearer <管理令牌>`。

基座没有公网入站时，用 `deploy/frpc.toml` 把 gateway 映到 `dsh.xx.yy.com`。容器只发布 gateway 端口。DSH 可执行文件由 `CLOUD_DSH_DSH_BIN` 指定，本仓库不包含 DSH 源码。
