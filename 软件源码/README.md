# 注册机 Electron 骨架

本目录按 `开发提示文档` 搭建 Electron + TypeScript 骨架。

## 已搭建

- Electron 主进程、preload、渲染层入口。
- 复用 `../ui设计/任务调度管理面板.html` 作为主界面。
- Orchestrator / TaskRepository / 状态机 / 设置校验。
- HeroSMS、Cloudflare Email Worker、CaptchaSolver、SiteAdapter 的接口边界。
- Codex-Manager OAuth JSON 导出契约。
- Vitest 单元测试。

## 合规边界

OpenAI/ChatGPT 注册自动化、验证码求解、OAuth token 抓取均仅保留接口边界，不在骨架中实现。
后续添加站点适配器前，必须确认合法授权、官方/已验证接口契约和测试方案。

## 命令

```bash
npm test
npm run build
npm run dev
```
